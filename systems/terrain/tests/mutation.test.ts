import { describe, expect, it } from "vitest";
import type {
  CellCoord,
  ChunkCoord,
  VertexCoord,
  WorldSpatialRead,
} from "@web-three-city/world";
import type {
  ApplyTerrainEdits,
  TerrainMutationRejectionCode,
} from "../src/commands";
import {
  createTerrainSystem,
  type TerrainFieldSource,
} from "../src/composition";
import { applyTerrainEdits } from "../src/application/apply-terrain-edits";
import {
  createTerrainState,
  type CanonicalVertexRecord,
  type TerrainState,
} from "../src/domain/terrain-state";
import type { LogicalElevation } from "../src/index";
import {
  TEST_CHUNK_AXIS_COUNT,
  TEST_TERRAIN_PROVENANCE,
  TEST_VERTEX_SIZE,
  createTestWorldSpatialRead,
  testWorldRejection,
} from "./helpers/world-spatial-fixture";

function isValidCell(cell: CellCoord): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.z) &&
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < 512 &&
    cell.z < 512
  );
}

function compareZX<T extends { readonly x: number; readonly z: number }>(
  left: T,
  right: T,
): number {
  return left.z - right.z || left.x - right.x;
}

function mutationWorld(): WorldSpatialRead {
  const base = createTestWorldSpatialRead();

  function incident(vertex: VertexCoord): readonly CellCoord[] | undefined {
    if (base.ownerChunk(vertex).status !== "success") return undefined;
    const cells: CellCoord[] = [];
    for (const z of [vertex.z - 1, vertex.z]) {
      for (const x of [vertex.x - 1, vertex.x]) {
        const cell = { x, z };
        if (isValidCell(cell)) cells.push(cell);
      }
    }
    return cells;
  }

  return {
    ...base,
    incidentCells(vertex) {
      const cells = incident(vertex);
      return cells === undefined
        ? testWorldRejection()
        : { status: "success", value: cells };
    },
    touchingChunks(vertex) {
      const cells = incident(vertex);
      if (cells === undefined) return testWorldRejection();
      const byKey = new Map<string, ChunkCoord>();
      for (const cell of cells) {
        const chunk = {
          x: Math.floor(cell.x / 32),
          z: Math.floor(cell.z / 32),
        };
        byKey.set(`${chunk.z}:${chunk.x}`, chunk);
      }
      return {
        status: "success",
        value: [...byKey.values()].sort(compareZX),
      };
    },
  };
}

function zeroField(): TerrainFieldSource {
  return {
    vertexWidth: TEST_VERTEX_SIZE,
    vertexHeight: TEST_VERTEX_SIZE,
    elevationAt: () => 0,
  };
}

function createSystem() {
  const result = createTerrainSystem({
    world: mutationWorld(),
    ...TEST_TERRAIN_PROVENANCE,
    source: zeroField(),
  });
  expect(result.status).toBe("success");
  if (result.status !== "success")
    throw new Error("Terrain construction failed");
  return result.value;
}

function command(
  edits: readonly {
    readonly vertex: VertexCoord;
    readonly elevation: number;
  }[],
): ApplyTerrainEdits {
  return {
    edits: edits.map((edit) => ({
      vertex: { ...edit.vertex },
      elevation: edit.elevation as LogicalElevation,
    })),
  };
}

function partialState(
  extraRecords: readonly CanonicalVertexRecord[] = [],
): TerrainState {
  const record: CanonicalVertexRecord = {
    chunkKey: 0,
    vertexKey: 0,
    elevation: 0 as LogicalElevation,
  };
  return createTerrainState({
    provenance: TEST_TERRAIN_PROVENANCE,
    records: [record, ...extraRecords],
    loadedChunkKeys: [0],
    expectedChunkCount: TEST_CHUNK_AXIS_COUNT * TEST_CHUNK_AXIS_COUNT,
  });
}

function stateFacts(state: TerrainState) {
  return {
    revision: state.revision,
    loadedChunkKeys: [...state.loadedChunkKeys].sort((a, b) => a - b),
    chunks: [...state.chunks.entries()]
      .sort(([a], [b]) => a - b)
      .map(([chunkKey, chunk]) => [
        chunkKey,
        [...chunk.entries()].sort(([a], [b]) => a - b),
      ]),
  };
}

function expectRejected(
  result: ReturnType<typeof applyTerrainEdits>["result"],
  code: TerrainMutationRejectionCode,
) {
  expect(result.status).toBe("rejected");
  if (result.status !== "rejected") return;
  expect(result.rejection.code).toBe(code);
}

describe("Terrain atomic mutation", () => {
  it("rejects duplicate vertices before later validation classes and preserves state exactly", () => {
    const state = partialState();
    const before = stateFacts(state);
    const outcome = applyTerrainEdits({
      state,
      world: mutationWorld(),
      command: command([
        { vertex: { x: 513, z: 0 }, elevation: 4097 },
        { vertex: { x: 513, z: 0 }, elevation: 0 },
      ]),
    });

    expectRejected(outcome.result, "TERRAIN_MUTATION_DUPLICATE_VERTEX");
    expect(outcome.state).toBe(state);
    expect(stateFacts(outcome.state)).toEqual(before);
  });

  it("rejects duplicate same-value edits instead of normalizing them", () => {
    const state = partialState();
    const outcome = applyTerrainEdits({
      state,
      world: mutationWorld(),
      command: command([
        { vertex: { x: 0, z: 0 }, elevation: 0 },
        { vertex: { x: 0, z: 0 }, elevation: 0 },
      ]),
    });

    expectRejected(outcome.result, "TERRAIN_MUTATION_DUPLICATE_VERTEX");
    expect(outcome.state).toBe(state);
  });

  it.each([
    {
      label: "out-of-bounds vertex",
      edits: [
        { vertex: { x: 0, z: 0 }, elevation: 1 },
        { vertex: { x: 513, z: 0 }, elevation: 4097 },
      ],
      code: "TERRAIN_MUTATION_VERTEX_OUT_OF_BOUNDS",
    },
    {
      label: "non-integer vertex",
      edits: [{ vertex: { x: 0.5, z: 0 }, elevation: 1 }],
      code: "TERRAIN_MUTATION_VERTEX_OUT_OF_BOUNDS",
    },
    {
      label: "unloaded owner Chunk",
      edits: [{ vertex: { x: 33, z: 1 }, elevation: 4097 }],
      code: "TERRAIN_MUTATION_CHUNK_UNAVAILABLE",
    },
    {
      label: "non-integer elevation",
      edits: [{ vertex: { x: 0, z: 0 }, elevation: 1.5 }],
      code: "TERRAIN_MUTATION_ELEVATION_INVALID",
    },
    {
      label: "out-of-range elevation",
      edits: [{ vertex: { x: 0, z: 0 }, elevation: 4097 }],
      code: "TERRAIN_MUTATION_ELEVATION_OUT_OF_RANGE",
    },
  ] as const)("rejects $label atomically", ({ edits, code }) => {
    const state = partialState();
    const before = stateFacts(state);
    const outcome = applyTerrainEdits({
      state,
      world: mutationWorld(),
      command: command(edits),
    });

    expectRejected(outcome.result, code);
    expect(outcome.state).toBe(state);
    expect(stateFacts(outcome.state)).toEqual(before);
  });

  it("uses canonical (z,x) order to identify the first elevation rejection", () => {
    const state = partialState([
      { chunkKey: 0, vertexKey: 514, elevation: 0 as LogicalElevation },
      { chunkKey: 0, vertexKey: 1028, elevation: 0 as LogicalElevation },
    ]);
    const outcome = applyTerrainEdits({
      state,
      world: mutationWorld(),
      command: command([
        { vertex: { x: 2, z: 2 }, elevation: 4097 },
        { vertex: { x: 1, z: 1 }, elevation: 1.5 },
      ]),
    });

    expectRejected(outcome.result, "TERRAIN_MUTATION_ELEVATION_INVALID");
    if (outcome.result.status !== "rejected") return;
    expect(outcome.result.rejection.detail).toMatchObject({
      vertex: { x: 1, z: 1 },
      value: 1.5,
    });
  });

  it("accepts an empty edit list as an exact no-op", () => {
    const system = createSystem();
    expect(system.commands.applyEdits(command([]))).toEqual({
      status: "success",
      value: {
        changed: false,
        previousRevision: 0,
        newRevision: 0,
        changeSet: {
          previousRevision: 0,
          newRevision: 0,
          changedVertices: [],
          affectedCells: [],
          touchingLogicalChunks: [],
        },
      },
    });
    expect(system.read.revision()).toBe(0);
  });

  it("filters same-value edits only after validation and preserves revision", () => {
    const system = createSystem();
    const result = system.commands.applyEdits(
      command([{ vertex: { x: 32, z: 32 }, elevation: 0 }]),
    );

    expect(result).toMatchObject({
      status: "success",
      value: { changed: false, previousRevision: 0, newRevision: 0 },
    });
    expect(system.read.revision()).toBe(0);
    expect(system.read.elevationAt({ x: 32, z: 32 })).toEqual({
      status: "success",
      value: 0,
    });
  });

  it("commits one seam edit atomically and reports deterministic derived facts", () => {
    const system = createSystem();
    const result = system.commands.applyEdits(
      command([{ vertex: { x: 32, z: 32 }, elevation: 4 }]),
    );

    expect(result).toEqual({
      status: "success",
      value: {
        changed: true,
        previousRevision: 0,
        newRevision: 1,
        changeSet: {
          previousRevision: 0,
          newRevision: 1,
          changedVertices: [{ x: 32, z: 32 }],
          affectedCells: [
            { x: 31, z: 31 },
            { x: 32, z: 31 },
            { x: 31, z: 32 },
            { x: 32, z: 32 },
          ],
          touchingLogicalChunks: [
            { x: 0, z: 0 },
            { x: 1, z: 0 },
            { x: 0, z: 1 },
            { x: 1, z: 1 },
          ],
        },
      },
    });
    expect(system.read.revision()).toBe(1);
    expect(system.read.elevationAt({ x: 32, z: 32 })).toEqual({
      status: "success",
      value: 4,
    });
  });

  it("de-duplicates and canonically orders multi-vertex derived topology", () => {
    const system = createSystem();
    const result = system.commands.applyEdits(
      command([
        { vertex: { x: 33, z: 32 }, elevation: 2 },
        { vertex: { x: 32, z: 32 }, elevation: 1 },
      ]),
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.value.changeSet.affectedCells).toEqual([
      { x: 31, z: 31 },
      { x: 32, z: 31 },
      { x: 33, z: 31 },
      { x: 31, z: 32 },
      { x: 32, z: 32 },
      { x: 33, z: 32 },
    ]);
    expect(result.value.changeSet.touchingLogicalChunks).toEqual([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
      { x: 1, z: 1 },
    ]);
  });

  it("advances revision exactly once for one hundred actual edits", () => {
    const system = createSystem();
    const edits = Array.from({ length: 100 }, (_, index) => ({
      vertex: { x: (index % 10) + 1, z: Math.floor(index / 10) + 1 },
      elevation: 1,
    }));

    const result = system.commands.applyEdits(command(edits));
    expect(result).toMatchObject({
      status: "success",
      value: { changed: true, previousRevision: 0, newRevision: 1 },
    });
    expect(system.read.revision()).toBe(1);
    if (result.status !== "success") return;
    expect(result.value.changeSet.changedVertices).toHaveLength(100);
  });

  it("normalizes caller order before commit and reporting", () => {
    const forward = createSystem();
    const reverse = createSystem();
    const edits = [
      { vertex: { x: 33, z: 32 }, elevation: 3 },
      { vertex: { x: 31, z: 33 }, elevation: 2 },
      { vertex: { x: 32, z: 32 }, elevation: 1 },
    ] as const;

    const forwardResult = forward.commands.applyEdits(command(edits));
    const reverseResult = reverse.commands.applyEdits(
      command([...edits].reverse()),
    );

    expect(reverseResult).toEqual(forwardResult);
    if (forwardResult.status !== "success") return;
    expect(forwardResult.value.changeSet.changedVertices).toEqual([
      { x: 32, z: 32 },
      { x: 33, z: 32 },
      { x: 31, z: 33 },
    ]);
  });
});
