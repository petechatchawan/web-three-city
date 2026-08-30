import { describe, expect, it } from "vitest";
import { computePresentationNormal } from "../src/presentation/three/geometry/presentation-normal";
import { readSectorSurface } from "../src/presentation/three/geometry/read-sector-surface";
import { createRenderSectorLayout } from "../src/presentation/three/topology/render-sector";
import {
  TEST_MAP_DEFINITION,
  createFunctionalTerrainRead,
  createPresentationWorldSpatialRead,
} from "./helpers/presentation-fixture";

const layout = createRenderSectorLayout(TEST_MAP_DEFINITION);
const world = createPresentationWorldSpatialRead();

function expectNormalClose(
  actual: { readonly x: number; readonly y: number; readonly z: number },
  expected: { readonly x: number; readonly y: number; readonly z: number },
): void {
  expect(actual.x).toBeCloseTo(expected.x, 8);
  expect(actual.y).toBeCloseTo(expected.y, 8);
  expect(actual.z).toBeCloseTo(expected.z, 8);
}

function normalFor(
  sector: { readonly x: number; readonly z: number },
  vertex: { readonly x: number; readonly z: number },
  elevation: (x: number, z: number) => number,
) {
  const snapshot = readSectorSurface({
    layout,
    sector,
    terrain: createFunctionalTerrainRead(elevation),
  });
  return computePresentationNormal({
    snapshot,
    world,
    vertex,
    cellSizeMeters: TEST_MAP_DEFINITION.cellSizeMeters,
  });
}

describe("presentation normals", () => {
  it("returns the upward unit normal for flat Terrain at interior, edge, and corner vertices", () => {
    const flat = () => 20;

    for (const sample of [
      { sector: { x: 0, z: 0 }, vertex: { x: 10, z: 10 } },
      { sector: { x: 0, z: 0 }, vertex: { x: 0, z: 10 } },
      { sector: { x: 0, z: 0 }, vertex: { x: 0, z: 0 } },
    ]) {
      expectNormalClose(normalFor(sample.sector, sample.vertex, flat), {
        x: 0,
        y: 1,
        z: 0,
      });
    }
  });

  it("produces an approximately unit-length normal on non-flat Terrain", () => {
    const normal = normalFor({ x: 0, z: 0 }, { x: 20, z: 20 }, (x, z) =>
      Math.floor((x + z) / 4),
    );
    const length = Math.hypot(normal.x, normal.y, normal.z);

    expect(length).toBeCloseTo(1, 8);
    expect(normal.y).toBeGreaterThan(0);
  });

  it("uses the same global incident-triangle neighborhood on both sides of a render-sector seam", () => {
    const seamVertex = { x: 64, z: 96 };
    const asymmetricField = (x: number) => (x <= 64 ? 0 : (x - 64) * 8);

    const west = normalFor({ x: 0, z: 1 }, seamVertex, asymmetricField);
    const east = normalFor({ x: 1, z: 1 }, seamVertex, asymmetricField);

    expectNormalClose(west, east);
    expect(west.x).not.toBeCloseTo(0, 8);
    expect(west.y).toBeGreaterThan(0);
  });
});
