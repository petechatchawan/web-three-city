import type { RoadMutationPlan } from '@web-three-city/road-core';
import type { ZoneMutationPlan } from '@web-three-city/zone-core';
import type { GameTransactionDomain, GameTransactionState } from './game-tool-events.js';
import type { TerraformStrokeRelease } from './terraform-stroke-session.js';

export interface GameTransactionAnnouncement {
  readonly state: GameTransactionState;
  readonly domain: GameTransactionDomain;
}

const TERRAFORM_COMMIT = Object.freeze({
  state: 'committing',
  domain: 'terraform',
}) satisfies GameTransactionAnnouncement;
const ROAD_COMMIT = Object.freeze({
  state: 'committing',
  domain: 'road',
}) satisfies GameTransactionAnnouncement;
const ZONE_COMMIT = Object.freeze({
  state: 'committing',
  domain: 'zone',
}) satisfies GameTransactionAnnouncement;

export function terraformReleaseTransaction(
  release: TerraformStrokeRelease,
): GameTransactionAnnouncement | null {
  return release.kind === 'commit' ? TERRAFORM_COMMIT : null;
}

export function roadPlanTransaction(
  plan: RoadMutationPlan | null,
): GameTransactionAnnouncement | null {
  return plan?.valid === true ? ROAD_COMMIT : null;
}

export function zonePlanTransaction(
  plan: ZoneMutationPlan | null,
): GameTransactionAnnouncement | null {
  return plan?.valid === true ? ZONE_COMMIT : null;
}
