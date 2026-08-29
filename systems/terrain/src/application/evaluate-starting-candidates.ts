import type { StartingCandidate } from "@web-three-city/world";
import type {
  StartingCandidateEvaluation,
  TerrainStartingReason,
} from "../contracts/generation";
import type { TerrainFieldSource } from "../contracts/terrain-composition";

const PATCH_RADIUS_CELLS = 4;
const MAX_CELL_CORNER_RANGE = 8;
const MAX_PATCH_ELEVATION_RANGE = 24;
const MAX_ANCHOR_CORNER_RANGE = 4;

function readElevation(
  field: TerrainFieldSource,
  x: number,
  z: number,
): number | undefined {
  if (x < 0 || z < 0 || x >= field.vertexWidth || z >= field.vertexHeight) {
    return undefined;
  }

  const value = field.elevationAt(x, z);
  return Number.isInteger(value) ? value : undefined;
}

function evaluateCandidate(
  candidate: StartingCandidate,
  field: TerrainFieldSource,
): StartingCandidateEvaluation {
  let unavailable = false;
  let patchMin = Number.POSITIVE_INFINITY;
  let patchMax = Number.NEGATIVE_INFINITY;
  let maxCellCornerRange = 0;
  let anchorCellCornerRange = 0;

  const xStart = candidate.anchor.x - PATCH_RADIUS_CELLS;
  const xEnd = candidate.anchor.x + PATCH_RADIUS_CELLS;
  const zStart = candidate.anchor.z - PATCH_RADIUS_CELLS;
  const zEnd = candidate.anchor.z + PATCH_RADIUS_CELLS;

  for (let z = zStart; z <= zEnd; z += 1) {
    for (let x = xStart; x <= xEnd; x += 1) {
      const corners = [
        readElevation(field, x, z),
        readElevation(field, x + 1, z),
        readElevation(field, x, z + 1),
        readElevation(field, x + 1, z + 1),
      ] as const;

      for (const elevation of corners) {
        if (elevation === undefined) {
          unavailable = true;
          continue;
        }
        patchMin = Math.min(patchMin, elevation);
        patchMax = Math.max(patchMax, elevation);
      }

      if (corners.some((elevation) => elevation === undefined)) {
        continue;
      }

      const availableCorners = corners as readonly [
        number,
        number,
        number,
        number,
      ];
      const cellRange =
        Math.max(...availableCorners) - Math.min(...availableCorners);
      maxCellCornerRange = Math.max(maxCellCornerRange, cellRange);

      if (x === candidate.anchor.x && z === candidate.anchor.z) {
        anchorCellCornerRange = cellRange;
      }
    }
  }

  const patchElevationRange =
    patchMin === Number.POSITIVE_INFINITY ||
    patchMax === Number.NEGATIVE_INFINITY
      ? 0
      : patchMax - patchMin;
  const reasons: TerrainStartingReason[] = [];
  if (unavailable) reasons.push("TERRAIN_START_UNAVAILABLE");
  if (maxCellCornerRange > MAX_CELL_CORNER_RANGE) {
    reasons.push("TERRAIN_START_CELL_RELIEF_EXCEEDED");
  }
  if (patchElevationRange > MAX_PATCH_ELEVATION_RANGE) {
    reasons.push("TERRAIN_START_PATCH_RELIEF_EXCEEDED");
  }
  if (anchorCellCornerRange > MAX_ANCHOR_CORNER_RANGE) {
    reasons.push("TERRAIN_START_ANCHOR_RELIEF_EXCEEDED");
  }

  return Object.freeze({
    regionId: candidate.regionId,
    eligible: reasons.length === 0,
    patchElevationRange,
    maxCellCornerRange,
    anchorCellCornerRange,
    reasons: Object.freeze(reasons),
  });
}

export function evaluateStartingCandidates(
  candidates: readonly StartingCandidate[],
  field: TerrainFieldSource,
): readonly StartingCandidateEvaluation[] {
  return Object.freeze(
    candidates.map((candidate) => evaluateCandidate(candidate, field)),
  );
}
