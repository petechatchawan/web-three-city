import type {
  TerrainAuthorityRead,
  TerrainRevision,
} from "@web-three-city/terrain";
import type {
  ApplyTerrainEdits,
  TerrainCommands,
  TerrainMutationReceipt,
  TerrainMutationRejection,
} from "@web-three-city/terrain/commands";
import {
  parseLogicalElevation,
  type LogicalElevation,
} from "@web-three-city/terrain";
import type {
  TerraformPlan,
  TerraformTerrainInvalidation,
} from "@web-three-city/terraform";
import { createTerraformUndoHistory } from "@web-three-city/terraform/composition";
import { describe, expect, it } from "vitest";
import { createTerraformRuntime } from "../src/composition/terraform/create-terraform-runtime";

function revision(value: number): TerrainRevision {
  return value as TerrainRevision;
}

function elevation(value: number): LogicalElevation {
  const parsed = parseLogicalElevation(value);
  if (parsed.status !== "success") {
    throw new Error(`invalid test elevation ${value}`);
  }
  return parsed.value;
}

function plan(
  expectedRevision: number,
  previousElevation = 20,
  desiredElevation = 24,
): TerraformPlan {
  return Object.freeze({
    operation: "raise",
    targetCell: Object.freeze({ x: 10, z: 10 }),
    footprintCells: Object.freeze([Object.freeze({ x: 10, z: 10 })]),
    influenceCells: Object.freeze([]),
    edits: Object.freeze([
      Object.freeze({
        vertex: Object.freeze({ x: 10, z: 10 }),
        previousElevation: elevation(previousElevation),
        desiredElevation: elevation(desiredElevation),
      }),
    ]),
    expectedTerrainRevision: revision(expectedRevision),
  });
}

type CommandMode = "changed" | "unchanged" | "rejected";

function createHarness(initialRevision = 100) {
  let currentRevision = revision(initialRevision);
  let commandMode: CommandMode = "changed";
  const appliedCommands: ApplyTerrainEdits[] = [];
  const projectionChanges: TerrainMutationReceipt["changeSet"][] = [];
  const debugChanges: TerrainMutationReceipt["changeSet"][] = [];
  const terraformInvalidations: TerraformTerrainInvalidation[] = [];
  const rejection: TerrainMutationRejection = Object.freeze({
    code: "TERRAIN_MUTATION_CHUNK_UNAVAILABLE",
    message: "test rejection",
  });

  const terrainRead = {
    revision: () => currentRevision,
  } as TerrainAuthorityRead;

  const commands: TerrainCommands = {
    applyEdits(command) {
      appliedCommands.push(command);
      if (commandMode === "rejected") {
        return { status: "rejected", rejection };
      }

      const previousRevision = currentRevision;
      const changed = commandMode === "changed";
      if (changed) {
        currentRevision = revision(currentRevision + 1);
      }
      const changeSet = Object.freeze({
        previousRevision,
        newRevision: currentRevision,
        changedVertices: Object.freeze(
          command.edits.map((edit) => Object.freeze({ ...edit.vertex })),
        ),
        affectedCells: Object.freeze([]),
        touchingLogicalChunks: Object.freeze([
          Object.freeze({ x: 0, z: 0 }),
          Object.freeze({ x: 1, z: 0 }),
        ]),
      });
      return {
        status: "success",
        value: Object.freeze({
          changed,
          previousRevision,
          newRevision: currentRevision,
          changeSet,
        }),
      };
    },
  };

  const undo = createTerraformUndoHistory(currentRevision);
  const runtime = createTerraformRuntime({
    terrain: { read: terrainRead, commands },
    projection: {
      rebuild(changeSet) {
        projectionChanges.push(changeSet);
      },
    },
    debugOverlay: {
      rebuild(changeSet) {
        debugChanges.push(changeSet);
      },
    },
    terraformPresentation: {
      rebuild(invalidation) {
        terraformInvalidations.push(invalidation);
      },
    },
    undo,
  });

  return {
    runtime,
    undo,
    appliedCommands,
    projectionChanges,
    debugChanges,
    terraformInvalidations,
    rejection,
    setCommandMode(mode: CommandMode) {
      commandMode = mode;
    },
    setRevision(value: number) {
      currentRevision = revision(value);
    },
  };
}

describe("Terraform live Terrain mutation runtime", () => {
  it("rejects a stale plan before issuing a Terrain command", () => {
    const harness = createHarness(101);

    expect(harness.runtime.commit(plan(100))).toEqual({
      status: "rejected",
      reason: "STALE_TERRAIN_REVISION",
    });
    expect(harness.appliedCommands).toHaveLength(0);
  });

  it("does not erase valid Terraform Undo when an old preview follows its own commit", () => {
    const harness = createHarness(100);

    expect(harness.runtime.commit(plan(100)).status).toBe("success");
    expect(harness.undo.depth()).toBe(1);

    expect(harness.runtime.commit(plan(100))).toEqual({
      status: "rejected",
      reason: "STALE_TERRAIN_REVISION",
    });
    expect(harness.undo.depth()).toBe(1);
    expect(harness.undo.expectedTerrainRevision()).toBe(101);
  });

  it("maps one changed action to one Terrain command, presentation fan-out, and Undo entry", () => {
    const harness = createHarness(100);
    const result = harness.runtime.commit(plan(100));

    expect(result.status).toBe("success");
    expect(harness.appliedCommands).toEqual([
      {
        edits: [{ vertex: { x: 10, z: 10 }, elevation: 24 }],
      },
    ]);
    expect(harness.projectionChanges).toHaveLength(1);
    expect(harness.debugChanges).toHaveLength(1);
    expect(harness.projectionChanges[0]).toBe(harness.debugChanges[0]);
    expect(harness.terraformInvalidations).toEqual([
      {
        touchingLogicalChunks: [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
        ],
      },
    ]);
    expect(Object.isFrozen(harness.terraformInvalidations[0])).toBe(true);
    expect(
      harness.terraformInvalidations[0]?.touchingLogicalChunks.every(
        Object.isFrozen,
      ),
    ).toBe(true);
    expect(harness.undo.depth()).toBe(1);
    expect(harness.undo.expectedTerrainRevision()).toBe(101);
  });

  it("treats a zero-edit plan as a no-op without issuing a Terrain command", () => {
    const harness = createHarness(100);
    const zeroEditPlan = Object.freeze({
      ...plan(100),
      edits: Object.freeze([]),
    });

    expect(harness.runtime.commit(zeroEditPlan)).toEqual({ status: "noop" });
    expect(harness.appliedCommands).toHaveLength(0);
    expect(harness.undo.depth()).toBe(0);
    expect(harness.projectionChanges).toHaveLength(0);
  });

  it("does not mutate Undo or presentation when Terrain rejects a commit", () => {
    const harness = createHarness(100);
    harness.setCommandMode("rejected");

    expect(harness.runtime.commit(plan(100))).toEqual({
      status: "rejected",
      reason: "TERRAIN_MUTATION_REJECTED",
      rejection: harness.rejection,
    });
    expect(harness.undo.depth()).toBe(0);
    expect(harness.projectionChanges).toHaveLength(0);
    expect(harness.debugChanges).toHaveLength(0);
    expect(harness.terraformInvalidations).toHaveLength(0);
  });

  it("does not create history or rebuild presentation for a successful unchanged receipt", () => {
    const harness = createHarness(100);
    harness.setCommandMode("unchanged");

    expect(harness.runtime.commit(plan(100))).toEqual({ status: "noop" });
    expect(harness.appliedCommands).toHaveLength(1);
    expect(harness.undo.depth()).toBe(0);
    expect(harness.projectionChanges).toHaveLength(0);
    expect(harness.debugChanges).toHaveLength(0);
    expect(harness.terraformInvalidations).toHaveLength(0);
  });

  it("applies exact inverse elevations and supports sequential Undo revisions", () => {
    const harness = createHarness(100);

    expect(harness.runtime.commit(plan(100, 20, 24)).status).toBe("success");
    expect(harness.runtime.commit(plan(101, 24, 28)).status).toBe("success");
    expect(harness.undo.depth()).toBe(2);

    expect(harness.runtime.undo().status).toBe("success");
    expect(harness.appliedCommands[2]).toEqual({
      edits: [{ vertex: { x: 10, z: 10 }, elevation: 24 }],
    });
    expect(harness.undo.depth()).toBe(1);
    expect(harness.undo.expectedTerrainRevision()).toBe(103);

    expect(harness.runtime.undo().status).toBe("success");
    expect(harness.appliedCommands[3]).toEqual({
      edits: [{ vertex: { x: 10, z: 10 }, elevation: 20 }],
    });
    expect(harness.undo.depth()).toBe(0);
    expect(harness.undo.expectedTerrainRevision()).toBe(104);
  });

  it("preserves the pending Undo entry when an inverse Terrain command is rejected", () => {
    const harness = createHarness(100);
    expect(harness.runtime.commit(plan(100)).status).toBe("success");
    harness.setCommandMode("rejected");

    expect(harness.runtime.undo()).toEqual({
      status: "rejected",
      reason: "TERRAIN_MUTATION_REJECTED",
      rejection: harness.rejection,
    });
    expect(harness.undo.depth()).toBe(1);
    expect(harness.undo.expectedTerrainRevision()).toBe(101);
    expect(harness.projectionChanges).toHaveLength(1);
  });

  it("disposes idempotently and rejects use after disposal", () => {
    const harness = createHarness(100);
    harness.runtime.dispose();
    expect(() => harness.runtime.dispose()).not.toThrow();
    expect(() => harness.runtime.commit(plan(100))).toThrow(/disposed/);
    expect(() => harness.runtime.undo()).toThrow(/disposed/);
    expect(harness.appliedCommands).toHaveLength(0);
  });

  it("invalidates stale Undo history after an external Terrain revision", () => {
    const harness = createHarness(100);
    expect(harness.runtime.commit(plan(100)).status).toBe("success");
    harness.setRevision(999);

    expect(harness.runtime.undo()).toEqual({ status: "unavailable" });
    expect(harness.undo.depth()).toBe(0);
    expect(harness.undo.expectedTerrainRevision()).toBe(999);
    expect(harness.appliedCommands).toHaveLength(1);
  });
});
