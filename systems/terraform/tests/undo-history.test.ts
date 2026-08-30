import { describe, expect, it } from "vitest";
import type { VertexCoord } from "@web-three-city/world";
import {
  parseLogicalElevation,
  type LogicalElevation,
  type TerrainRevision,
} from "@web-three-city/terrain";
import type {
  TerraformPlan,
  TerraformUndoHistory,
} from "@web-three-city/terraform";
import { createTerraformUndoHistory } from "@web-three-city/terraform/composition";

function revision(value: number): TerrainRevision {
  return value as TerrainRevision;
}

function elevation(value: number): LogicalElevation {
  const parsed = parseLogicalElevation(value);
  if (parsed.status !== "success")
    throw new Error(`invalid test elevation ${value}`);
  return parsed.value;
}

function plan(
  expectedRevision: number,
  edits: readonly {
    readonly vertex: VertexCoord;
    readonly previous: number;
    readonly desired: number;
  }[] = [
    {
      vertex: { x: 10, z: 10 },
      previous: 20,
      desired: 24,
    },
  ],
): TerraformPlan {
  return Object.freeze({
    operation: "raise",
    targetCell: { x: 10, z: 10 },
    footprintCells: [{ x: 10, z: 10 }],
    influenceCells: [],
    edits: edits.map((edit) =>
      Object.freeze({
        vertex: edit.vertex,
        previousElevation: elevation(edit.previous),
        desiredElevation: elevation(edit.desired),
      }),
    ),
    expectedTerrainRevision: revision(expectedRevision),
  });
}

function create(initialRevision = 100): TerraformUndoHistory {
  return createTerraformUndoHistory(revision(initialRevision));
}

describe("Terraform revision-safe Undo history", () => {
  it("records one inverse entry for a changed commit", () => {
    const history = create();
    history.recordCommit(plan(100), revision(101));

    expect(history.depth()).toBe(1);
    expect(history.expectedTerrainRevision()).toBe(101);
    expect(history.peekUndo(revision(101))).toEqual({
      inverseEdits: [{ vertex: { x: 10, z: 10 }, elevation: 20 }],
    });
  });

  it("does not create an Undo entry for a zero-edit plan", () => {
    const history = create();
    history.recordCommit(plan(100, []), revision(100));

    expect(history.depth()).toBe(0);
    expect(history.expectedTerrainRevision()).toBe(100);
    expect(history.peekUndo(revision(100))).toBeUndefined();
  });

  it("retains only the newest 100 entries", () => {
    const history = create(0);

    for (let current = 0; current < 101; current += 1) {
      history.recordCommit(
        plan(current, [
          {
            vertex: { x: current, z: 0 },
            previous: current,
            desired: current + 1,
          },
        ]),
        revision(current + 1),
      );
    }

    expect(history.depth()).toBe(100);
    expect(history.expectedTerrainRevision()).toBe(101);
    expect(history.peekUndo(revision(101))).toEqual({
      inverseEdits: [{ vertex: { x: 100, z: 0 }, elevation: 100 }],
    });
  });

  it("clears stale history and synchronizes when an external Terrain revision appears", () => {
    const history = create();
    history.recordCommit(plan(100), revision(101));

    expect(history.peekUndo(revision(999))).toBeUndefined();
    expect(history.depth()).toBe(0);
    expect(history.expectedTerrainRevision()).toBe(999);
  });

  it("allows sequential Undo after each Undo transaction advances Terrain revision", () => {
    const history = create();
    history.recordCommit(
      plan(100, [{ vertex: { x: 1, z: 1 }, previous: 10, desired: 11 }]),
      revision(101),
    );
    history.recordCommit(
      plan(101, [{ vertex: { x: 2, z: 2 }, previous: 20, desired: 21 }]),
      revision(102),
    );

    expect(history.peekUndo(revision(102))).toEqual({
      inverseEdits: [{ vertex: { x: 2, z: 2 }, elevation: 20 }],
    });

    history.recordUndo(revision(103));

    expect(history.depth()).toBe(1);
    expect(history.expectedTerrainRevision()).toBe(103);
    expect(history.peekUndo(revision(103))).toEqual({
      inverseEdits: [{ vertex: { x: 1, z: 1 }, elevation: 10 }],
    });
  });

  it("supports explicit external synchronization and clear", () => {
    const history = create();
    history.recordCommit(plan(100), revision(101));
    history.synchronizeExternalRevision(revision(200));

    expect(history.depth()).toBe(0);
    expect(history.expectedTerrainRevision()).toBe(200);

    history.recordCommit(plan(200), revision(201));
    history.clear();
    expect(history.depth()).toBe(0);
    expect(history.expectedTerrainRevision()).toBe(201);
  });
});
