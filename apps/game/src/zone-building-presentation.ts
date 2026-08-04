import type { ZoneToolMode } from './game-tool-mode.js';
import type { ZoneInputState } from './zone-stroke-controller.js';
import type { GameZoneInvalidReason, GuardedZoneCandidate } from './zone-building-guard.js';

export interface GuardedZonePresentation {
  readonly state: ZoneInputState;
  readonly reason: GameZoneInvalidReason | null;
  readonly effectiveCellCount: number;
  readonly invalidCellCount: number;
}

export function createGuardedZonePresentation(
  mode: ZoneToolMode | null,
  candidate: GuardedZoneCandidate | null,
): GuardedZonePresentation {
  const invalidCellCount =
    candidate === null
      ? 0
      : candidate.invalidReason === 'zone:building-occupied'
        ? candidate.blockedBuildingCells.length
        : candidate.corePlan.invalidCells.length;

  return Object.freeze({
    state: Object.freeze({
      mode,
      strokeActive: candidate !== null,
      previewValid: candidate?.valid ?? null,
      previewInvalidReason: candidate?.invalidReason ?? null,
      previewCellCount: candidate?.corePlan.requestedCells.length ?? 0,
    }),
    reason: candidate?.invalidReason ?? null,
    effectiveCellCount: candidate?.valid === true ? candidate.corePlan.changedCells.length : 0,
    invalidCellCount,
  });
}
