import type { InteractionEvidence } from './interaction-evidence.js';
import type {
  GameTransactionDomain,
  GameTransactionState,
} from './game-tool-events.js';

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
const TERRAFORM_UNDO = Object.freeze({
  state: 'undoing',
  domain: 'terraform',
}) satisfies GameTransactionAnnouncement;
const ROAD_UNDO = Object.freeze({
  state: 'undoing',
  domain: 'road',
}) satisfies GameTransactionAnnouncement;

export function pointerReleaseTransaction(
  evidence: InteractionEvidence | undefined,
): GameTransactionAnnouncement | null {
  if (evidence?.terraform.strokeActive === true && evidence.terraform.acceptedStampCount > 0) {
    return TERRAFORM_COMMIT;
  }
  if (evidence?.road.strokeActive === true && evidence.road.previewValid === true) {
    return ROAD_COMMIT;
  }
  return null;
}

export function undoTransaction(
  evidence: InteractionEvidence | undefined,
): GameTransactionAnnouncement | null {
  const domain = evidence?.road.undoKind;
  if (domain === 'terraform') return TERRAFORM_UNDO;
  if (domain === 'road') return ROAD_UNDO;
  return null;
}
