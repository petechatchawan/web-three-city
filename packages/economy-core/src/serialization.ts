import {
  cloneEconomySnapshot,
  validateEconomySnapshot,
  type EconomySnapshotV1,
} from './economy-snapshot.js';
import type { EconomyRulesV1 } from './rules.js';
import { validateEconomyRules } from './rules.js';

export interface EconomySaveV1 extends EconomySnapshotV1 {
  readonly schemaVersion: 1;
}

export const encodeEconomySaveV1 = (snapshot: EconomySnapshotV1): EconomySaveV1 =>
  Object.freeze({ schemaVersion: 1, ...cloneEconomySnapshot(snapshot) });

export type DecodeEconomySaveResult =
  | Readonly<{ ok: true; value: EconomySnapshotV1 }>
  | Readonly<{ ok: false; reason: 'invalid-rules' | 'invalid-save' }>;

export function decodeEconomySaveV1(
  input: unknown,
  rules: EconomyRulesV1,
): DecodeEconomySaveResult {
  if (!validateEconomyRules(rules)) return { ok: false, reason: 'invalid-rules' };
  if (typeof input !== 'object' || input === null || !('schemaVersion' in input)) {
    return { ok: false, reason: 'invalid-save' };
  }
  const { schemaVersion, ...candidate } = input as Record<string, unknown>;
  if (schemaVersion !== 1 || !validateEconomySnapshot(candidate, rules)) {
    return { ok: false, reason: 'invalid-save' };
  }
  return { ok: true, value: cloneEconomySnapshot(candidate) };
}
