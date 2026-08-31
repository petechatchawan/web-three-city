import type {
  LogicalElevation,
  TerrainAuthorityRead,
  TerrainRevision,
} from "@web-three-city/terrain";
import type {
  MapDefinitionRead,
  MapStateRead,
  RegionId,
  WorldSpatialRead,
} from "@web-three-city/world";
import type { LineBasicMaterial } from "three";
import { LineSegments } from "three";
import { describe, expect, it, vi } from "vitest";
import type {
  TerraformPlan,
  TerraformPreview,
} from "../src/contracts/terraform-types";
import {
  buildTerraformCellHighlightLineData,
  buildTerraformGridChunkLineData,
} from "../src/presentation/three/build-grid-chunk-geometry";
import { createTerraformThreeOverlayInternal } from "../src/presentation/three/terraform-three-overlay";

const asElevation = (value: number): LogicalElevation =>
  value as LogicalElevation;
const asRevision = (value: number): TerrainRevision => value as TerrainRevision;
const asRegion = (value: string): RegionId => value as RegionId;

function mapDefinition(
  input: {
    readonly width?: number;
    readonly height?: number;
    readonly chunkSize?: number;
  } = {},
): MapDefinitionRead {
  return {
    widthCells: input.width ?? 4,
    heightCells: input.height ?? 2,
    cellSizeMeters: 8,
    logicalChunkSizeCells: input.chunkSize ?? 2,
  } as unknown as MapDefinitionRead;
}

function mapState(unlocked: readonly string[] = ["r0"]): MapStateRead {
  return {
    unlockedRegionIds: Object.freeze(unlocked.map(asRegion)),
  } as unknown as MapStateRead;
}

function spatial(
  regionAt: (cell: {
    readonly x: number;
    readonly z: number;
  }) => string | undefined = () => "r0",
): WorldSpatialRead {
  return {
    regionAtCell(cell: { readonly x: number; readonly z: number }) {
      const region = regionAt(cell);
      return region === undefined
        ? { status: "rejected", code: "WORLD_COORD_OUT_OF_BOUNDS" }
        : { status: "success", value: asRegion(region) };
    },
  } as unknown as WorldSpatialRead;
}

interface TestTerrain extends TerrainAuthorityRead {
  setUnavailable(
    predicate:
      | ((vertex: { readonly x: number; readonly z: number }) => boolean)
      | undefined,
  ): void;
  readCount(): number;
  resetReadCount(): void;
}

function terrain(
  input: {
    readonly completeness?: "partial" | "full";
    readonly elevationAt?: (vertex: {
      readonly x: number;
      readonly z: number;
    }) => number;
  } = {},
): TestTerrain {
  let unavailable:
    | ((vertex: { readonly x: number; readonly z: number }) => boolean)
    | undefined;
  let reads = 0;
  return {
    revision: () => asRevision(1),
    completeness: () => input.completeness ?? "full",
    elevationAt(vertex) {
      reads += 1;
      if (unavailable?.(vertex)) {
        return {
          status: "unavailable",
          code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE",
          chunk: { x: 0, z: 0 },
        };
      }
      return {
        status: "success",
        value: asElevation(
          input.elevationAt?.(vertex) ?? vertex.x + vertex.z * 10,
        ),
      };
    },
    setUnavailable(predicate) {
      unavailable = predicate;
    },
    readCount: () => reads,
    resetReadCount() {
      reads = 0;
    },
  } as TestTerrain;
}

function validPreview(
  input: {
    readonly operation?: "raise" | "lower" | "flatten";
    readonly footprint?: readonly {
      readonly x: number;
      readonly z: number;
    }[];
    readonly influence?: readonly {
      readonly x: number;
      readonly z: number;
    }[];
    readonly edits?: TerraformPlan["edits"];
  } = {},
): TerraformPreview {
  return Object.freeze({
    status: "valid" as const,
    plan: Object.freeze({
      operation: input.operation ?? "raise",
      targetCell: Object.freeze({ x: 0, z: 0 }),
      footprintCells: Object.freeze(input.footprint ?? [{ x: 0, z: 0 }]),
      influenceCells: Object.freeze(input.influence ?? []),
      edits: Object.freeze(
        input.edits ?? [
          Object.freeze({
            vertex: Object.freeze({ x: 0, z: 0 }),
            previousElevation: asElevation(0),
            desiredElevation: asElevation(4),
          }),
        ],
      ),
      expectedTerrainRevision: asRevision(1),
    }),
  });
}

function invalidPreview(): TerraformPreview {
  return Object.freeze({
    status: "invalid" as const,
    operation: "raise" as const,
    targetCell: Object.freeze({ x: 0, z: 0 }),
    footprintCells: Object.freeze([Object.freeze({ x: 0, z: 0 })]),
    reason: "LOCKED_REGION" as const,
    expectedTerrainRevision: asRevision(1),
  });
}

function line(
  root: { getObjectByName(name: string): unknown },
  name: string,
): LineSegments {
  const object = root.getObjectByName(name);
  expect(object).toBeInstanceOf(LineSegments);
  return object as LineSegments;
}

describe("Terraform Three grid geometry", () => {
  it("emits one editable cell as four exact terrain-conforming boundary segments", () => {
    const result = buildTerraformGridChunkLineData({
      mapDefinition: mapDefinition({ width: 1, height: 1, chunkSize: 1 }),
      mapState: mapState(),
      spatial: spatial(),
      terrain: terrain(),
      chunk: { x: 0, z: 0 },
      surfaceOffsetMeters: 0.04,
    });

    expect(result.cellCount).toBe(1);
    expect(result.segmentCount).toBe(4);
    const ys = new Set<number>();
    for (let index = 1; index < result.positions.length; index += 3) {
      ys.add(Number(result.positions[index]!.toFixed(2)));
    }
    expect(ys).toEqual(new Set([0.04, 0.29, 2.54, 2.79]));
  });

  it("filters locked cells from the editable grid", () => {
    const result = buildTerraformGridChunkLineData({
      mapDefinition: mapDefinition({ width: 2, height: 1, chunkSize: 2 }),
      mapState: mapState(["r0"]),
      spatial: spatial((cell) => (cell.x === 0 ? "r0" : "r1")),
      terrain: terrain(),
      chunk: { x: 0, z: 0 },
      surfaceOffsetMeters: 0.04,
    });
    expect(result.cellCount).toBe(1);
    expect(result.segmentCount).toBe(4);
  });

  it("deduplicates shared edges inside a logical chunk", () => {
    const result = buildTerraformGridChunkLineData({
      mapDefinition: mapDefinition({ width: 2, height: 1, chunkSize: 2 }),
      mapState: mapState(),
      spatial: spatial(),
      terrain: terrain(),
      chunk: { x: 0, z: 0 },
      surfaceOffsetMeters: 0.04,
    });
    expect(result.cellCount).toBe(2);
    expect(result.segmentCount).toBe(7);
  });

  it("does not query nonexistent Terrain for out-of-world invalid highlight cells", () => {
    const authority = terrain();
    const result = buildTerraformCellHighlightLineData({
      mapDefinition: mapDefinition({ width: 1, height: 1, chunkSize: 1 }),
      terrain: authority,
      cells: [
        { x: -1, z: 0 },
        { x: 0, z: 0 },
        { x: 1, z: 0 },
      ],
      surfaceOffsetMeters: 0.1,
    });
    expect(result.cellCount).toBe(1);
    expect(authority.readCount()).toBe(4);
  });

  it("fails loudly when World cannot resolve an in-bounds cell region", () => {
    expect(() =>
      buildTerraformGridChunkLineData({
        mapDefinition: mapDefinition({ width: 1, height: 1, chunkSize: 1 }),
        mapState: mapState(),
        spatial: spatial(() => undefined),
        terrain: terrain(),
        chunk: { x: 0, z: 0 },
        surfaceOffsetMeters: 0.04,
      }),
    ).toThrow(/region unavailable/);
  });
});

describe("Terraform Three overlay", () => {
  it("is lazy while inactive and materializes editable chunks only when activated", () => {
    const overlay = createTerraformThreeOverlayInternal({
      mapDefinition: mapDefinition(),
      mapState: mapState(),
      spatial: spatial(),
      terrain: terrain(),
    });
    expect(overlay.root.visible).toBe(false);
    expect(
      overlay.root.getObjectByName("terraform-grid-chunk:0:0"),
    ).toBeUndefined();
    overlay.setActive(true);
    expect(overlay.root.visible).toBe(true);
    expect(line(overlay.root, "terraform-grid-chunk:0:0")).toBeDefined();
  });

  it("renders valid footprint and influence as distinct semantic layers", () => {
    const overlay = createTerraformThreeOverlayInternal({
      mapDefinition: mapDefinition(),
      mapState: mapState(),
      spatial: spatial(),
      terrain: terrain(),
    });
    overlay.setActive(true);
    overlay.setPreview(
      validPreview({
        footprint: [{ x: 0, z: 0 }],
        influence: [{ x: 1, z: 0 }],
      }),
    );
    expect(line(overlay.root, "terraform-footprint")).toBeDefined();
    expect(line(overlay.root, "terraform-influence")).toBeDefined();
  });

  it("replaces valid transient layers with the invalid footprint transactionally", () => {
    const overlay = createTerraformThreeOverlayInternal({
      mapDefinition: mapDefinition(),
      mapState: mapState(),
      spatial: spatial(),
      terrain: terrain(),
    });
    overlay.setActive(true);
    overlay.setPreview(validPreview());
    const old = line(overlay.root, "terraform-footprint");
    const dispose = vi.spyOn(old.geometry, "dispose");
    overlay.setPreview(invalidPreview());
    expect(overlay.root.getObjectByName("terraform-footprint")).toBeUndefined();
    expect(line(overlay.root, "terraform-invalid")).toBeDefined();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("renders a valid Flatten target-level marker", () => {
    const overlay = createTerraformThreeOverlayInternal({
      mapDefinition: mapDefinition(),
      mapState: mapState(),
      spatial: spatial(),
      terrain: terrain(),
    });
    overlay.setActive(true);
    overlay.setPreview(
      validPreview({
        operation: "flatten",
        edits: [
          {
            vertex: { x: 0, z: 0 },
            previousElevation: asElevation(0),
            desiredElevation: asElevation(8),
          },
        ],
      }),
    );
    const marker = line(overlay.root, "terraform-flattenReference");
    const positions = marker.geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index += 1) {
      expect(Number(positions.getY(index).toFixed(2))).toBe(2.08);
    }
  });

  it("clears transient geometry without rebuilding the base grid", () => {
    const overlay = createTerraformThreeOverlayInternal({
      mapDefinition: mapDefinition(),
      mapState: mapState(),
      spatial: spatial(),
      terrain: terrain(),
    });
    overlay.setActive(true);
    const grid = line(overlay.root, "terraform-grid-chunk:0:0");
    overlay.setPreview(validPreview());
    const footprint = line(overlay.root, "terraform-footprint");
    const dispose = vi.spyOn(footprint.geometry, "dispose");
    overlay.setPreview(undefined);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(overlay.root.getObjectByName("terraform-grid-chunk:0:0")).toBe(grid);
  });

  it("rebuilds only dirty materialized logical chunks", () => {
    const overlay = createTerraformThreeOverlayInternal({
      mapDefinition: mapDefinition(),
      mapState: mapState(),
      spatial: spatial(),
      terrain: terrain(),
    });
    overlay.setActive(true);
    const left = line(overlay.root, "terraform-grid-chunk:0:0");
    const right = line(overlay.root, "terraform-grid-chunk:1:0");
    const leftDispose = vi.spyOn(left.geometry, "dispose");
    overlay.rebuild({ touchingLogicalChunks: [{ x: 0, z: 0 }] });
    expect(overlay.root.getObjectByName("terraform-grid-chunk:0:0")).not.toBe(
      left,
    );
    expect(overlay.root.getObjectByName("terraform-grid-chunk:1:0")).toBe(
      right,
    );
    expect(leftDispose).toHaveBeenCalledTimes(1);
  });

  it("coalesces duplicate chunk invalidations", () => {
    const authority = terrain();
    const overlay = createTerraformThreeOverlayInternal({
      mapDefinition: mapDefinition(),
      mapState: mapState(),
      spatial: spatial(),
      terrain: authority,
    });
    overlay.setActive(true);
    authority.resetReadCount();
    overlay.rebuild({
      touchingLogicalChunks: [
        { x: 0, z: 0 },
        { x: 0, z: 0 },
      ],
    });
    expect(authority.readCount()).toBe(9);
  });

  it("preserves the published chunk when a staged rebuild fails", () => {
    const authority = terrain();
    const overlay = createTerraformThreeOverlayInternal({
      mapDefinition: mapDefinition(),
      mapState: mapState(),
      spatial: spatial(),
      terrain: authority,
    });
    overlay.setActive(true);
    const old = line(overlay.root, "terraform-grid-chunk:0:0");
    const dispose = vi.spyOn(old.geometry, "dispose");
    authority.setUnavailable((vertex) => vertex.x === 0 && vertex.z === 0);
    expect(() =>
      overlay.rebuild({ touchingLogicalChunks: [{ x: 0, z: 0 }] }),
    ).toThrow(/unavailable/);
    expect(overlay.root.getObjectByName("terraform-grid-chunk:0:0")).toBe(old);
    expect(dispose).not.toHaveBeenCalled();
  });

  it("keeps activation retryable when initial staging fails", () => {
    const authority = terrain();
    authority.setUnavailable((vertex) => vertex.x === 0 && vertex.z === 0);
    const overlay = createTerraformThreeOverlayInternal({
      mapDefinition: mapDefinition(),
      mapState: mapState(),
      spatial: spatial(),
      terrain: authority,
    });
    expect(() => overlay.setActive(true)).toThrow(/unavailable/);
    expect(overlay.root.visible).toBe(false);
    authority.setUnavailable(undefined);
    overlay.setActive(true);
    expect(overlay.root.visible).toBe(true);
  });

  it("preserves the previous preview when replacement staging fails", () => {
    const authority = terrain();
    const overlay = createTerraformThreeOverlayInternal({
      mapDefinition: mapDefinition(),
      mapState: mapState(),
      spatial: spatial(),
      terrain: authority,
    });
    overlay.setActive(true);
    overlay.setPreview(validPreview({ footprint: [{ x: 1, z: 0 }] }));
    const old = line(overlay.root, "terraform-footprint");
    const dispose = vi.spyOn(old.geometry, "dispose");
    authority.setUnavailable((vertex) => vertex.x === 0 && vertex.z === 0);
    expect(() =>
      overlay.setPreview(validPreview({ footprint: [{ x: 0, z: 0 }] })),
    ).toThrow(/unavailable/);
    expect(overlay.root.getObjectByName("terraform-footprint")).toBe(old);
    expect(dispose).not.toHaveBeenCalled();
  });

  it("releases geometry on deactivation and rebuilds on reactivation", () => {
    const overlay = createTerraformThreeOverlayInternal({
      mapDefinition: mapDefinition(),
      mapState: mapState(),
      spatial: spatial(),
      terrain: terrain(),
    });
    overlay.setActive(true);
    const old = line(overlay.root, "terraform-grid-chunk:0:0");
    const dispose = vi.spyOn(old.geometry, "dispose");
    overlay.setActive(false);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(overlay.root.visible).toBe(false);
    overlay.setActive(true);
    expect(overlay.root.getObjectByName("terraform-grid-chunk:0:0")).not.toBe(
      old,
    );
  });

  it("disposes shared materials exactly once and supports idempotent dispose", () => {
    const overlay = createTerraformThreeOverlayInternal({
      mapDefinition: mapDefinition(),
      mapState: mapState(),
      spatial: spatial(),
      terrain: terrain(),
    });
    overlay.setActive(true);
    overlay.setPreview(validPreview({ influence: [{ x: 1, z: 0 }] }));
    const materials = [
      line(overlay.root, "terraform-grid-chunk:0:0")
        .material as LineBasicMaterial,
      line(overlay.root, "terraform-footprint").material as LineBasicMaterial,
      line(overlay.root, "terraform-influence").material as LineBasicMaterial,
    ];
    const spies = materials.map((material) => vi.spyOn(material, "dispose"));
    overlay.dispose();
    overlay.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    expect(overlay.root.children).toHaveLength(0);
  });

  it("rejects incomplete Terrain at construction", () => {
    expect(() =>
      createTerraformThreeOverlayInternal({
        mapDefinition: mapDefinition(),
        mapState: mapState(),
        spatial: spatial(),
        terrain: terrain({ completeness: "partial" }),
      }),
    ).toThrow(/complete Terrain/);
  });
});
