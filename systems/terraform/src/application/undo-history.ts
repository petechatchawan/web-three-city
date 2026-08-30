import type { TerrainRevision } from "@web-three-city/terrain";
import type {
  TerraformPlan,
  TerraformUndoEntry,
  TerraformUndoHistory,
} from "../contracts/terraform-types";

const MAX_UNDO_ENTRIES = 100;

function createUndoEntry(plan: TerraformPlan): TerraformUndoEntry {
  return Object.freeze({
    inverseEdits: Object.freeze(
      plan.edits.map((edit) =>
        Object.freeze({
          vertex: Object.freeze({ x: edit.vertex.x, z: edit.vertex.z }),
          elevation: edit.previousElevation,
        }),
      ),
    ),
  });
}

export function createTerraformUndoHistoryInternal(
  initialRevision: TerrainRevision,
): TerraformUndoHistory {
  const entries: TerraformUndoEntry[] = [];
  let expectedRevision = initialRevision;

  function synchronizeExternalRevision(currentRevision: TerrainRevision): void {
    entries.length = 0;
    expectedRevision = currentRevision;
  }

  return Object.freeze({
    depth(): number {
      return entries.length;
    },

    expectedTerrainRevision(): TerrainRevision {
      return expectedRevision;
    },

    recordCommit(plan: TerraformPlan, newRevision: TerrainRevision): void {
      if (plan.expectedTerrainRevision !== expectedRevision) {
        entries.length = 0;
      }

      if (plan.edits.length > 0) {
        entries.push(createUndoEntry(plan));
        if (entries.length > MAX_UNDO_ENTRIES) {
          entries.splice(0, entries.length - MAX_UNDO_ENTRIES);
        }
      }

      expectedRevision = newRevision;
    },

    peekUndo(currentRevision: TerrainRevision): TerraformUndoEntry | undefined {
      if (currentRevision !== expectedRevision) {
        synchronizeExternalRevision(currentRevision);
        return undefined;
      }
      return entries.at(-1);
    },

    recordUndo(newRevision: TerrainRevision): void {
      entries.pop();
      expectedRevision = newRevision;
    },

    synchronizeExternalRevision,

    clear(): void {
      entries.length = 0;
    },
  });
}
