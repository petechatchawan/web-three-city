import type { CellCoord } from "@web-three-city/world";
import {
  BufferGeometry,
  DoubleSide,
  Group,
  type Mesh,
  MeshBasicMaterial,
  Raycaster,
} from "three";
import { describe, expect, it, vi } from "vitest";
import type { TerrainChangeSet } from "../src/contracts/mutation";
import type {
  TerrainAuthorityRead,
  TerrainCompleteness,
  TerrainRevision,
} from "../src/contracts/terrain-read";
import { createSectorRegistry } from "../src/presentation/three/projection/sector-registry";
import { createTerrainThreeProjectionInternal } from "../src/presentation/three/projection/terrain-projection";
import { createSectorResource } from "../src/presentation/three/resources/sector-resource";
import { createTerrainMaterial } from "../src/presentation/three/resources/terrain-material";
import {
  TEST_MAP_DEFINITION,
  createFunctionalTerrainRead,
  createPresentationWorldSpatialRead,
} from "./helpers/presentation-fixture";

const world = createPresentationWorldSpatialRead();

function changeSet(
  previousRevision: number,
  newRevision: number,
  affectedCells: readonly CellCoord[],
): TerrainChangeSet {
  return {
    previousRevision,
    newRevision,
    changedVertices: [],
    affectedCells,
    touchingLogicalChunks: [],
  };
}

function createControlledTerrain() {
  const base = createFunctionalTerrainRead(() => 0, 0);
  let revision: TerrainRevision = 0;
  let completeness: TerrainCompleteness = "full";
  let failedVertex: string | undefined;
  let revisionScript: TerrainRevision[] = [];

  const read: TerrainAuthorityRead = {
    ...base,
    revision() {
      const scripted = revisionScript.shift();
      return scripted ?? revision;
    },
    completeness() {
      return completeness;
    },
    elevationAt(vertex) {
      if (`${vertex.x}:${vertex.z}` === failedVertex) {
        return {
          status: "unavailable",
          code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE",
          chunk: { x: 0, z: 0 },
        };
      }
      return base.elevationAt(vertex);
    },
  };

  return {
    read,
    setRevision(value: number) {
      revision = value;
    },
    setCompleteness(value: TerrainCompleteness) {
      completeness = value;
    },
    failAt(vertex?: { readonly x: number; readonly z: number }) {
      failedVertex = vertex ? `${vertex.x}:${vertex.z}` : undefined;
    },
    scriptRevisions(values: readonly number[]) {
      revisionScript = [...values];
    },
  };
}

function projectionInput(terrain: TerrainAuthorityRead) {
  return {
    mapDefinition: TEST_MAP_DEFINITION,
    world,
    terrain,
  } as const;
}

function meshMap(root: Group): Map<string, Mesh> {
  return new Map(root.children.map((child) => [child.name, child as Mesh]));
}

describe("Terrain Three.js resource ownership", () => {
  it("shares one Terrain material while each sector owns its geometry", () => {
    const material = createTerrainMaterial();
    const geometry00 = new BufferGeometry();
    const geometry10 = new BufferGeometry();
    const resource00 = createSectorResource({
      coord: { x: 0, z: 0 },
      geometry: geometry00,
      material,
    });
    const resource10 = createSectorResource({
      coord: { x: 1, z: 0 },
      geometry: geometry10,
      material,
    });

    expect(material.side).toBe(DoubleSide);
    expect(resource00.mesh.material).toBe(material);
    expect(resource10.mesh.material).toBe(material);
    expect(resource00.geometry).toBe(geometry00);
    expect(resource10.geometry).toBe(geometry10);
    expect(resource00.geometry).not.toBe(resource10.geometry);

    resource00.dispose();
    resource10.dispose();
    material.dispose();
  });

  it("disposes owned geometry exactly once without disposing the shared material", () => {
    const material = createTerrainMaterial();
    const geometry = new BufferGeometry();
    let geometryDisposeCount = 0;
    let materialDisposeCount = 0;
    geometry.addEventListener("dispose", () => {
      geometryDisposeCount += 1;
    });
    material.addEventListener("dispose", () => {
      materialDisposeCount += 1;
    });

    const resource = createSectorResource({
      coord: { x: 2, z: 3 },
      geometry,
      material,
    });
    resource.dispose();
    resource.dispose();

    expect(geometryDisposeCount).toBe(1);
    expect(materialDisposeCount).toBe(0);

    material.dispose();
    expect(materialDisposeCount).toBe(1);
  });
});

describe("sector registry", () => {
  function resource(x: number, z: number) {
    return createSectorResource({
      coord: { x, z },
      geometry: new BufferGeometry(),
      material: createTerrainMaterial(),
    });
  }

  it("returns canonical values and replaces only an existing key", () => {
    const registry = createSectorRegistry();
    const resource10 = resource(1, 0);
    const resource00 = resource(0, 0);
    const replacement00 = resource(0, 0);

    registry.insert(resource10);
    registry.insert(resource00);
    expect(registry.values().map(({ coord }) => coord)).toEqual([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    ]);
    expect(registry.replace(replacement00)).toBe(resource00);
    expect(registry.get({ x: 0, z: 0 })).toBe(replacement00);
    expect(registry.get({ x: 1, z: 0 })).toBe(resource10);
    expect(registry.clear()).toEqual([replacement00, resource10]);
    expect(registry.size()).toBe(0);

    for (const item of [resource00, replacement00, resource10]) {
      item.dispose();
      const material = item.mesh.material;
      if (!Array.isArray(material)) material.dispose();
    }
  });

  it("rejects duplicate insert and replace of a missing key", () => {
    const registry = createSectorRegistry();
    const resource00 = resource(0, 0);
    const duplicate00 = resource(0, 0);
    const missing10 = resource(1, 0);

    registry.insert(resource00);
    expect(() => registry.insert(duplicate00)).toThrow(/already registered/i);
    expect(() => registry.replace(missing10)).toThrow(/not registered/i);

    for (const item of [resource00, duplicate00, missing10]) {
      item.dispose();
      const material = item.mesh.material;
      if (!Array.isArray(material)) material.dispose();
    }
  });
});

describe("TerrainThreeProjection lifecycle", () => {
  it("rejects incomplete Terrain authority before publishing presentation", () => {
    const terrain = createControlledTerrain();
    terrain.setCompleteness("partial");

    expect(
      createTerrainThreeProjectionInternal(projectionInput(terrain.read)),
    ).toEqual({
      status: "rejected",
      code: "TERRAIN_PRESENTATION_TERRAIN_INCOMPLETE",
    });
  });

  it("builds 64 sectors at one revision with one shared material", () => {
    const terrain = createControlledTerrain();
    const result = createTerrainThreeProjectionInternal(
      projectionInput(terrain.read),
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.value.root.children).toHaveLength(64);
    expect(
      new Set(
        result.value.root.children.map((child) => (child as Mesh).material),
      ).size,
    ).toBe(1);

    result.value.dispose();
  });

  it("cleans up and rejects a mixed-revision initial projection", () => {
    const terrain = createControlledTerrain();
    terrain.scriptRevisions([0, 0, 0, 1, 1]);
    const geometryDispose = vi.spyOn(BufferGeometry.prototype, "dispose");
    const materialDispose = vi.spyOn(MeshBasicMaterial.prototype, "dispose");

    expect(() =>
      createTerrainThreeProjectionInternal(projectionInput(terrain.read)),
    ).toThrow(/snapshot revision mismatch/i);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);

    geometryDispose.mockRestore();
    materialDispose.mockRestore();
  });

  it("replaces only localized dirty sectors and preserves the shared material", () => {
    const terrain = createControlledTerrain();
    const result = createTerrainThreeProjectionInternal(
      projectionInput(terrain.read),
    );
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    const before = meshMap(result.value.root);
    const target = before.get("terrain-sector:2:2");
    expect(target).toBeDefined();
    if (target === undefined) return;
    let oldGeometryDisposeCount = 0;
    let materialDisposeCount = 0;
    target.geometry.addEventListener("dispose", () => {
      oldGeometryDisposeCount += 1;
    });
    const material = target.material;
    if (Array.isArray(material))
      throw new Error("Expected one shared Terrain material.");
    material.addEventListener("dispose", () => {
      materialDisposeCount += 1;
    });

    terrain.setRevision(1);
    result.value.rebuild(changeSet(0, 1, [{ x: 130, z: 130 }]));

    const after = meshMap(result.value.root);
    const changed = [...before.entries()]
      .filter(([key, mesh]) => after.get(key) !== mesh)
      .map(([key]) => key);
    expect(changed).toEqual(["terrain-sector:2:2"]);
    expect(oldGeometryDisposeCount).toBe(1);
    expect(materialDisposeCount).toBe(0);
    expect((after.get("terrain-sector:2:2") as Mesh).material).toBe(material);

    result.value.dispose();
  });

  it("stages all replacements before swap and can retry after presentation failure", () => {
    const terrain = createControlledTerrain();
    const result = createTerrainThreeProjectionInternal(
      projectionInput(terrain.read),
    );
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    const before = meshMap(result.value.root);
    terrain.setRevision(1);
    terrain.failAt({ x: 100, z: 10 });
    const geometryDispose = vi.spyOn(BufferGeometry.prototype, "dispose");
    const mutation = changeSet(0, 1, [{ x: 63, z: 63 }]);

    expect(() => result.value.rebuild(mutation)).toThrow(
      /authority unavailable/i,
    );
    expect(meshMap(result.value.root)).toEqual(before);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    geometryDispose.mockRestore();

    terrain.failAt();
    expect(() => result.value.rebuild(mutation)).not.toThrow();
    const after = meshMap(result.value.root);
    const changed = [...before.entries()].filter(
      ([key, mesh]) => after.get(key) !== mesh,
    );
    expect(changed).toHaveLength(4);

    result.value.dispose();
  });

  it("rejects stale, skipped, mixed, drifting, and malformed revision transitions", () => {
    const terrain = createControlledTerrain();
    const result = createTerrainThreeProjectionInternal(
      projectionInput(terrain.read),
    );
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(() =>
      result.value.rebuild(changeSet(99, 0, [{ x: 130, z: 130 }])),
    ).toThrow(/previous revision/i);
    expect(() =>
      result.value.rebuild(changeSet(0, 1, [{ x: 130, z: 130 }])),
    ).toThrow(/terrain revision/i);

    expect(() => result.value.rebuild(changeSet(0, 0, []))).not.toThrow();

    terrain.setRevision(1);
    expect(() => result.value.rebuild(changeSet(0, 1, []))).toThrow(
      /advanced without dirty sectors/i,
    );

    terrain.scriptRevisions([1, 2, 2]);
    expect(() =>
      result.value.rebuild(changeSet(0, 1, [{ x: 130, z: 130 }])),
    ).toThrow(/snapshot revision mismatch/i);

    terrain.scriptRevisions([1, 1, 1, 2]);
    const disposeSpy = vi.spyOn(BufferGeometry.prototype, "dispose");
    expect(() =>
      result.value.rebuild(changeSet(0, 1, [{ x: 130, z: 130 }])),
    ).toThrow(/changed during staged rebuild/i);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    disposeSpy.mockRestore();

    terrain.setRevision(0);
    result.value.dispose();
  });

  it("disposes all owned resources exactly once and rejects use after dispose", () => {
    const terrain = createControlledTerrain();
    const result = createTerrainThreeProjectionInternal(
      projectionInput(terrain.read),
    );
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    const parent = new Group();
    parent.add(result.value.root);
    let geometryDisposeCount = 0;
    for (const child of result.value.root.children) {
      (child as Mesh).geometry.addEventListener("dispose", () => {
        geometryDisposeCount += 1;
      });
    }
    const first = result.value.root.children[0] as Mesh;
    const material = first.material;
    if (Array.isArray(material))
      throw new Error("Expected one shared Terrain material.");
    let materialDisposeCount = 0;
    material.addEventListener("dispose", () => {
      materialDisposeCount += 1;
    });

    result.value.dispose();
    result.value.dispose();

    expect(geometryDisposeCount).toBe(64);
    expect(materialDisposeCount).toBe(1);
    expect(result.value.root.children).toHaveLength(0);
    expect(parent.children).not.toContain(result.value.root);
    expect(() => result.value.rebuild(changeSet(0, 0, []))).toThrow(
      /disposed/i,
    );
    expect(() => result.value.pick(new Raycaster())).toThrow(/disposed/i);
  });
});
