import type { ZoneMutationPlan } from '@web-three-city/zone-core';
import { describe, expect, it } from 'vitest';
import { createGuardedZonePresentation } from './zone-building-presentation.js';
import type { GuardedZoneCandidate } from './zone-building-guard.js';

function plan(): ZoneMutationPlan {
  return {
    requestedCells: Object.freeze([Object.freeze({ x: 2, z: 2 }), Object.freeze({ x: 3, z: 2 })]),
    changedCells: Object.freeze([Object.freeze({ x: 2, z: 2 }), Object.freeze({ x: 3, z: 2 })]),
    invalidCells: Object.freeze([]),
    valid: true,
    invalidReason: null,
  } as unknown as ZoneMutationPlan;
}

describe('guarded Zone Building presentation', () => {
  it('publishes the routed Building reason and exact blocked-cell count', () => {
    const corePlan = plan();
    const previewPlan = Object.freeze({ ...corePlan, valid: false });
    const candidate: GuardedZoneCandidate = Object.freeze({
      corePlan,
      previewPlan,
      valid: false,
      invalidReason: 'zone:building-occupied',
      blockedBuildingCells: Object.freeze([
        Object.freeze({ x: 2, z: 2 }),
        Object.freeze({ x: 3, z: 2 }),
      ]),
    });

    expect(createGuardedZonePresentation('zone-remove', candidate)).toEqual({
      state: {
        mode: 'zone-remove',
        strokeActive: true,
        previewValid: false,
        previewInvalidReason: 'zone:building-occupied',
        previewCellCount: 2,
      },
      reason: 'zone:building-occupied',
      effectiveCellCount: 0,
      invalidCellCount: 2,
    });
  });

  it('returns an idle preview when no candidate exists', () => {
    expect(createGuardedZonePresentation('zone-remove', null)).toEqual({
      state: {
        mode: 'zone-remove',
        strokeActive: false,
        previewValid: null,
        previewInvalidReason: null,
        previewCellCount: 0,
      },
      reason: null,
      effectiveCellCount: 0,
      invalidCellCount: 0,
    });
  });
});
