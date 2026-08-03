import type { RoadMutationPlan } from '@web-three-city/road-core';
import type { ZoneMutationPlan } from '@web-three-city/zone-core';
import { describe, expect, it } from 'vitest';
import type { InteractionEvidence } from './interaction-evidence.js';
import {
  roadPlanTransaction,
  terraformReleaseTransaction,
  undoTransaction,
  zonePlanTransaction,
} from './game-transaction-presentation.js';
import type { TerraformStrokeRelease } from './terraform-stroke-session.js';

function roadPlan(valid: boolean): RoadMutationPlan {
  return { valid } as RoadMutationPlan;
}

function evidence(
  undoKind: 'terraform' | 'road' | 'zone' | 'building' | null,
): InteractionEvidence {
  return {
    road: { undoKind },
  } as unknown as InteractionEvidence;
}

describe('game transaction presentation ownership', () => {
  it('announces only committed Terraform releases', () => {
    const commit = {
      kind: 'commit',
      plan: Object.freeze({}),
    } as unknown as TerraformStrokeRelease;
    const rejected = {
      kind: 'rejected',
      reason: 'terraform:road-occupied',
    } as TerraformStrokeRelease;

    expect(terraformReleaseTransaction(commit)).toEqual({
      state: 'committing',
      domain: 'terraform',
    });
    expect(terraformReleaseTransaction(rejected)).toBeNull();
    expect(terraformReleaseTransaction({ kind: 'no-change' })).toBeNull();
    expect(terraformReleaseTransaction({ kind: 'ignored' })).toBeNull();
  });

  it('announces only valid final Road plans', () => {
    expect(roadPlanTransaction(roadPlan(true))).toEqual({
      state: 'committing',
      domain: 'road',
    });
    expect(roadPlanTransaction(roadPlan(false))).toBeNull();
    expect(roadPlanTransaction(null)).toBeNull();
  });

  it('announces only valid final Zone plans', () => {
    expect(zonePlanTransaction({ valid: true } as ZoneMutationPlan)).toEqual({
      state: 'committing',
      domain: 'zone',
    });
    expect(zonePlanTransaction({ valid: false } as ZoneMutationPlan)).toBeNull();
    expect(zonePlanTransaction(null)).toBeNull();
  });

  it('derives Undo ownership from the tagged world Undo entry', () => {
    expect(undoTransaction(evidence('terraform'))).toEqual({
      state: 'undoing',
      domain: 'terraform',
    });
    expect(undoTransaction(evidence('road'))).toEqual({
      state: 'undoing',
      domain: 'road',
    });
    expect(undoTransaction(evidence('zone'))).toEqual({
      state: 'undoing',
      domain: 'zone',
    });
    expect(undoTransaction(evidence('building'))).toEqual({
      state: 'undoing',
      domain: 'building',
    });
    expect(undoTransaction(evidence(null))).toBeNull();
    expect(undoTransaction(undefined)).toBeNull();
  });
});
