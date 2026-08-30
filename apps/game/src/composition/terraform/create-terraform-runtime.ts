import type { TerrainSessionHandle } from "@web-three-city/orchestration-city-session";
import type {
  TerrainChangeSet,
  TerrainMutationReceipt,
  TerrainMutationRejection,
  TerrainVertexEdit,
} from "@web-three-city/terrain/commands";
import type {
  TerraformPlan,
  TerraformTerrainInvalidation,
  TerraformUndoEntry,
  TerraformUndoHistory,
} from "@web-three-city/terraform";

export interface TerrainChangeSetRebuildPort {
  rebuild(changeSet: TerrainChangeSet): void;
}

export interface TerraformInvalidationRebuildPort {
  rebuild(invalidation: TerraformTerrainInvalidation): void;
}

export interface CreateTerraformRuntimeInput {
  readonly terrain: Pick<TerrainSessionHandle, "read" | "commands">;
  readonly projection: TerrainChangeSetRebuildPort;
  readonly debugOverlay: TerrainChangeSetRebuildPort;
  readonly terraformPresentation?: TerraformInvalidationRebuildPort;
  readonly undo: TerraformUndoHistory;
}

export type TerraformCommitResult =
  | { readonly status: "success"; readonly receipt: TerrainMutationReceipt }
  | { readonly status: "noop" }
  | {
      readonly status: "rejected";
      readonly reason: "STALE_TERRAIN_REVISION";
    }
  | TerraformMutationRejectedResult;

export type TerraformUndoResult =
  | { readonly status: "success"; readonly receipt: TerrainMutationReceipt }
  | { readonly status: "noop" }
  | { readonly status: "unavailable" }
  | TerraformMutationRejectedResult;

export interface TerraformRuntime {
  commit(plan: TerraformPlan): TerraformCommitResult;
  undo(): TerraformUndoResult;
}

interface TerraformMutationRejectedResult {
  readonly status: "rejected";
  readonly reason: "TERRAIN_MUTATION_REJECTED";
  readonly rejection: TerrainMutationRejection;
}

function cloneVertex(vertex: { readonly x: number; readonly z: number }) {
  return Object.freeze({ x: vertex.x, z: vertex.z });
}

function mapPlanEdits(plan: TerraformPlan): readonly TerrainVertexEdit[] {
  return Object.freeze(
    plan.edits.map((edit) =>
      Object.freeze({
        vertex: cloneVertex(edit.vertex),
        elevation: edit.desiredElevation,
      }),
    ),
  );
}

function mapUndoEdits(entry: TerraformUndoEntry): readonly TerrainVertexEdit[] {
  return Object.freeze(
    entry.inverseEdits.map((edit) =>
      Object.freeze({
        vertex: cloneVertex(edit.vertex),
        elevation: edit.elevation,
      }),
    ),
  );
}

function mapTerraformInvalidation(
  changeSet: TerrainChangeSet,
): TerraformTerrainInvalidation {
  return Object.freeze({
    touchingLogicalChunks: Object.freeze(
      changeSet.touchingLogicalChunks.map((chunk) =>
        Object.freeze({ x: chunk.x, z: chunk.z }),
      ),
    ),
  });
}

function rejectedMutation(
  rejection: TerrainMutationRejection,
): TerraformMutationRejectedResult {
  return Object.freeze({
    status: "rejected" as const,
    reason: "TERRAIN_MUTATION_REJECTED" as const,
    rejection,
  });
}

function fanOutPresentation(
  receipt: TerrainMutationReceipt,
  input: CreateTerraformRuntimeInput,
): void {
  input.projection.rebuild(receipt.changeSet);
  input.debugOverlay.rebuild(receipt.changeSet);
  input.terraformPresentation?.rebuild(
    mapTerraformInvalidation(receipt.changeSet),
  );
}

export function createTerraformRuntime(
  input: CreateTerraformRuntimeInput,
): TerraformRuntime {
  const runtime: TerraformRuntime = {
    commit(plan) {
      const currentRevision = input.terrain.read.revision();
      if (currentRevision !== plan.expectedTerrainRevision) {
        if (input.undo.expectedTerrainRevision() !== currentRevision) {
          input.undo.synchronizeExternalRevision(currentRevision);
        }
        return Object.freeze({
          status: "rejected" as const,
          reason: "STALE_TERRAIN_REVISION" as const,
        });
      }

      if (plan.edits.length === 0) {
        return Object.freeze({ status: "noop" as const });
      }

      const result = input.terrain.commands.applyEdits({
        edits: mapPlanEdits(plan),
      });
      if (result.status === "rejected") {
        return rejectedMutation(result.rejection);
      }

      const receipt = result.value;
      if (!receipt.changed) {
        return Object.freeze({ status: "noop" as const });
      }

      input.undo.recordCommit(plan, receipt.newRevision);
      fanOutPresentation(receipt, input);
      return Object.freeze({ status: "success" as const, receipt });
    },

    undo() {
      const currentRevision = input.terrain.read.revision();
      const entry = input.undo.peekUndo(currentRevision);
      if (entry === undefined) {
        return Object.freeze({ status: "unavailable" as const });
      }

      const result = input.terrain.commands.applyEdits({
        edits: mapUndoEdits(entry),
      });
      if (result.status === "rejected") {
        return rejectedMutation(result.rejection);
      }

      const receipt = result.value;
      if (!receipt.changed) {
        return Object.freeze({ status: "noop" as const });
      }

      input.undo.recordUndo(receipt.newRevision);
      fanOutPresentation(receipt, input);
      return Object.freeze({ status: "success" as const, receipt });
    },
  };

  return Object.freeze(runtime);
}
