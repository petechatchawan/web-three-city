import type { CellCoord, MapDefinitionRead } from "@web-three-city/world";
import {
  parseLogicalElevation,
  type LogicalElevation,
  type TerrainRevision,
} from "@web-three-city/terrain";
import type {
  PlanTerraformInput,
  TerraformInvalidReason,
  TerraformPlan,
  TerraformPreview,
  TerraformVertexMutation,
} from "../contracts/terraform-types";
import { buildBrushFootprint } from "../domain/brush-footprint";
import { strengthLevels } from "../domain/strength";

function invalidPreview(
  input: PlanTerraformInput,
  expectedTerrainRevision: TerrainRevision,
  footprintCells: readonly CellCoord[],
  reason: TerraformInvalidReason,
): TerraformPreview {
  return Object.freeze({
    status: "invalid" as const,
    operation: input.operation,
    targetCell: input.targetCell,
    footprintCells,
    reason,
    expectedTerrainRevision,
  });
}

function isCellInWorld(cell: CellCoord, mapDefinition: MapDefinitionRead): boolean {
  return (
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < mapDefinition.widthCells &&
    cell.z < mapDefinition.heightCells
  );
}

function cellKey(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function sortCells(cells: Iterable<CellCoord>): readonly CellCoord[] {
  return Object.freeze(
    [...cells]
      .map((cell) => Object.freeze({ x: cell.x, z: cell.z }))
      .sort((left, right) => left.z - right.z || left.x - right.x),
  );
}

function desiredElevationFor(
  input: PlanTerraformInput,
  current: LogicalElevation,
): LogicalElevation | undefined {
  if (input.operation === "flatten") return input.flattenTarget;

  const direction = input.operation === "lower" ? -1 : 1;
  const parsed = parseLogicalElevation(
    current + strengthLevels(input.strength) * direction,
  );
  return parsed.status === "success" ? parsed.value : undefined;
}

export function planTerraformInternal(input: PlanTerraformInput): TerraformPreview {
  const expectedTerrainRevision = input.terrain.revision();
  const footprint = buildBrushFootprint(input.targetCell, input.brushSize);

  if (footprint.cells.some((cell) => !isCellInWorld(cell, input.mapDefinition))) {
    return invalidPreview(
      input,
      expectedTerrainRevision,
      footprint.cells,
      "OUT_OF_WORLD",
    );
  }

  const unlocked = new Set(input.mapState.unlockedRegionIds);
  for (const cell of footprint.cells) {
    const region = input.spatial.regionAtCell(cell);
    if (region.status !== "success" || !unlocked.has(region.value)) {
      return invalidPreview(
        input,
        expectedTerrainRevision,
        footprint.cells,
        "LOCKED_REGION",
      );
    }
  }

  if (input.operation === "flatten" && input.flattenTarget === undefined) {
    return invalidPreview(
      input,
      expectedTerrainRevision,
      footprint.cells,
      "FLATTEN_TARGET_NOT_SELECTED",
    );
  }

  const edits: TerraformVertexMutation[] = [];

  for (const vertex of footprint.vertices) {
    const current = input.terrain.elevationAt(vertex);
    if (current.status !== "success") {
      return invalidPreview(
        input,
        expectedTerrainRevision,
        footprint.cells,
        "TERRAIN_UNAVAILABLE",
      );
    }

    const desiredElevation = desiredElevationFor(input, current.value);
    if (desiredElevation === undefined) {
      return invalidPreview(
        input,
        expectedTerrainRevision,
        footprint.cells,
        "ELEVATION_LIMIT",
      );
    }

    if (desiredElevation !== current.value) {
      edits.push(
        Object.freeze({
          vertex: Object.freeze({ x: vertex.x, z: vertex.z }),
          previousElevation: current.value,
          desiredElevation,
        }),
      );
    }
  }

  const primaryCellKeys = new Set(footprint.cells.map(cellKey));
  const influenceByKey = new Map<string, CellCoord>();

  for (const edit of edits) {
    const incident = input.spatial.incidentCells(edit.vertex);
    if (incident.status !== "success") continue;

    for (const cell of incident.value) {
      const key = cellKey(cell);
      if (!primaryCellKeys.has(key)) influenceByKey.set(key, cell);
    }
  }

  const plan: TerraformPlan = Object.freeze({
    operation: input.operation,
    targetCell: Object.freeze({ x: input.targetCell.x, z: input.targetCell.z }),
    footprintCells: footprint.cells,
    influenceCells: sortCells(influenceByKey.values()),
    edits: Object.freeze(edits),
    expectedTerrainRevision,
  });

  return Object.freeze({ status: "valid" as const, plan });
}
