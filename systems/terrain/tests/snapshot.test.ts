import { describe, expect, it } from "vitest";
import type { TerrainStateSnapshotV1 } from "../src/index";
import { parseLogicalElevation } from "../src/index";
import { createTerrainSystem, restoreTerrainSystem } from "../src/composition";
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

  it("restores a mutated Terrain snapshot exactly and continues revision history", () => {
    const terrain = createSystem();
    const nextElevation = parseLogicalElevation(23);
    expect(nextElevation.status).toBe("success");
    if (nextElevation.status !== "success") return;
    const mutation = terrain.commands.applyEdits({
      edits: [{ vertex: { x: 64, z: 64 }, elevation: nextElevation.value }],
    });
    expect(mutation.status).toBe("success");

    const beforeSample = terrain.read.sampleSurface(
      { x: 63, z: 63 },
      32768,
      32768,
    );
    const snapshot = terrain.captureSnapshot();
    const restored = restoreTerrainSystem({
      world: createPresentationWorldSpatialRead(),
      mapDefinitionId: TEST_TERRAIN_PROVENANCE.mapDefinitionId,
      snapshot,
    });

    expect(restored.status).toBe("success");
    if (restored.status !== "success") return;
    expect(restored.value.captureSnapshot()).toEqual(snapshot);
    expect(
      restored.value.read.sampleSurface({ x: 63, z: 63 }, 32768, 32768),
    ).toEqual(beforeSample);

    const restoredCurrent = restored.value.read.elevationAt({ x: 64, z: 64 });
    expect(restoredCurrent).toEqual({ status: "success", value: 23 });
    const after = parseLogicalElevation(24);
    expect(after.status).toBe("success");
    if (after.status !== "success") return;
    const nextMutation = restored.value.commands.applyEdits({
      edits: [{ vertex: { x: 64, z: 64 }, elevation: after.value }],
    });
    expect(nextMutation).toMatchObject({
      status: "success",
      value: {
        previousRevision: snapshot.revision,
        newRevision: snapshot.revision + 1,
      },
    });
  });

  it.each([
    [
      "unsupported snapshot version",
      { snapshotVersion: 2 },
      "snapshot-incompatible",
    ],
    [
      "wrong map definition",
      { mapDefinitionId: "other-map" },
      "snapshot-incompatible",
    ],
    [
      "unsupported generator profile",
      { generationProfileVersion: 999 },
      "snapshot-incompatible",
    ],
    ["malformed seed", { selectedSeed64: "seed" }, "snapshot-invalid"],
    [
      "malformed fingerprint",
      { fingerprint: "fingerprint" },
      "snapshot-invalid",
    ],
    ["negative revision", { revision: -1 }, "snapshot-invalid"],
    ["duplicate chunk", null, "snapshot-invalid"],
    ["missing full chunk", null, "snapshot-invalid"],
    ["invalid elevation", null, "snapshot-invalid"],
  ])(
    "rejects %s without publishing Terrain",
    (_label, patch, expectedReason) => {
      const base = createSystem().captureSnapshot();
      let malformed: unknown = { ...base, ...(patch ?? {}) };

      if (_label === "duplicate chunk") {
        malformed = { ...base, chunks: [...base.chunks, base.chunks[0]] };
      }
      if (_label === "missing full chunk") {
        malformed = { ...base, chunks: base.chunks.slice(0, -1) };
      }
      if (_label === "invalid elevation") {
        const first = base.chunks[0];
        if (first === undefined)
          throw new Error("expected first snapshot chunk");
        malformed = {
          ...base,
          chunks: [
            { ...first, elevations: [4097, ...first.elevations.slice(1)] },
            ...base.chunks.slice(1),
          ],
        };
      }

      const result = restoreTerrainSystem({
        world: createPresentationWorldSpatialRead(),
        mapDefinitionId: TEST_TERRAIN_PROVENANCE.mapDefinitionId,
        snapshot: malformed as TerrainStateSnapshotV1,
      });

      expect(result).toMatchObject({
        status: "rejected",
        reason: expectedReason,
      });
      expect("value" in result).toBe(false);
    },
  );
});
