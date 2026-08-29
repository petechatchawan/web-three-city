import { describe, expect, it } from "vitest";
import { parseLogicalElevation } from "../src/index";
import { createTerrainSystem } from "../src/composition";
import {
  TEST_TERRAIN_PROVENANCE,
  TEST_VERTEX_SIZE,
} from "./helpers/world-spatial-fixture";
import { createPresentationWorldSpatialRead } from "./helpers/presentation-fixture";

const TEST_FINGERPRINT = "0x0123456789ABCDEF";

function createSystem() {
  const result = createTerrainSystem({
    world: createPresentationWorldSpatialRead(),
    ...TEST_TERRAIN_PROVENANCE,
    fingerprint: TEST_FINGERPRINT,
    source: {
      vertexWidth: TEST_VERTEX_SIZE,
      vertexHeight: TEST_VERTEX_SIZE,
      elevationAt(x: number, z: number) {
        return ((x * 3 + z * 5) % 33) - 16;
      },
    },
  });
  expect(result.status).toBe("success");
  if (result.status !== "success") {
    throw new Error(`expected Terrain system: ${result.reason}`);
  }
  return result.value;
}

describe("Terrain canonical snapshot", () => {
  it("captures every canonical Vertex exactly once in canonical Chunk and owner order", () => {
    const terrain = createSystem();
    const snapshot = terrain.captureSnapshot();

    expect(snapshot).toMatchObject({
      snapshotVersion: 1,
      ...TEST_TERRAIN_PROVENANCE,
      fingerprint: TEST_FINGERPRINT,
      revision: 0,
      completeness: "full",
    });
    expect(snapshot.chunks).toHaveLength(256);
    expect(snapshot.chunks[0]?.chunk).toEqual({ x: 0, z: 0 });
    expect(snapshot.chunks[1]?.chunk).toEqual({ x: 1, z: 0 });
    expect(snapshot.chunks[16]?.chunk).toEqual({ x: 0, z: 1 });
    expect(snapshot.chunks.at(-1)?.chunk).toEqual({ x: 15, z: 15 });

    const elevationCount = snapshot.chunks.reduce(
      (sum, chunk) => sum + chunk.elevations.length,
      0,
    );
    expect(elevationCount).toBe(TEST_VERTEX_SIZE * TEST_VERTEX_SIZE);
  });

  it("preserves the current revision and contains no presentation authority", () => {
    const terrain = createSystem();
    const current = terrain.read.elevationAt({ x: 64, z: 64 });
    expect(current.status).toBe("success");
    if (current.status !== "success") return;
    const next = parseLogicalElevation(current.value + 1);
    expect(next.status).toBe("success");
    if (next.status !== "success") return;

    const mutation = terrain.commands.applyEdits({
      edits: [{ vertex: { x: 64, z: 64 }, elevation: next.value }],
    });
    expect(mutation.status).toBe("success");

    const snapshot = terrain.captureSnapshot();
    expect(snapshot.revision).toBe(1);
    const json = JSON.stringify(snapshot);
    for (const forbidden of [
      "Mesh",
      "BufferGeometry",
      "material",
      "renderSector",
      "camera",
      "debug",
      "raycaster",
      "normal",
    ]) {
      expect(json.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
