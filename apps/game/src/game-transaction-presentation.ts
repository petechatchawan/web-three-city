import type { RoadMutationPlan } from '@web-three-city/road-core';
import type { ZoneMutationPlan } from '@web-three-city/zone-core';
import type { InteractionEvidence } from './interaction-evidence.js';
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
const TERRAFORM_UNDO = Object.freeze({
  state: 'undoing',
  domain: 'terraform',
}) satisfies GameTransactionAnnouncement;
const ROAD_UNDO = Object.freeze({
  state: 'undoing',
  domain: 'road',
}) satisfies GameTransactionAnnouncement;
const ZONE_UNDO = Object.freeze({
  state: 'undoing',
  domain: 'zone',
}) satisfies GameTransactionAnnouncement;
const BUILDING_UNDO = Object.freeze({
  state: 'undoing',
  domain: 'building',
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

export function undoTransaction(
  evidence: InteractionEvidence | undefined,
): GameTransactionAnnouncement | null {
  const domain = evidence?.road.undoKind;
  if (domain === 'terraform') return TERRAFORM_UNDO;
  if (domain === 'road') return ROAD_UNDO;
  if (domain === 'zone') return ZONE_UNDO;
  if (domain === 'building') return BUILDING_UNDO;
  return null;
}
