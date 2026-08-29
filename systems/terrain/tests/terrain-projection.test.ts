import { BufferGeometry, DoubleSide } from "three";
import { describe, expect, it } from "vitest";
import { createSectorRegistry } from "../src/presentation/three/projection/sector-registry";
import { createSectorResource } from "../src/presentation/three/resources/sector-resource";
import { createTerrainMaterial } from "../src/presentation/three/resources/terrain-material";

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
