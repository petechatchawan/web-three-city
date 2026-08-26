import { macroHourIndex, macroHourValue } from '@web-three-city/simulation-core';
import type { MacroHourIndex } from '@web-three-city/simulation-core';
import {
  cloneEconomySnapshot,
  validateEconomySnapshot,
  type EconomySnapshotV1,
} from './economy-snapshot.js';
import type { EconomyRulesV1 } from './rules.js';
import { validateEconomyRules } from './rules.js';

export interface EconomySaveV1 extends Omit<
  EconomySnapshotV1,
  'latestCycleSettlementAtMacroHourIndex' | 'lastMonthlyCloseAtMacroHourIndex'
> {
  readonly schemaVersion: 1;
  readonly lastDailySettlementTick: number;
  readonly lastMonthlyCloseTick: number | null;
}

export const encodeEconomySaveV1 = (snapshot: EconomySnapshotV1): EconomySaveV1 => {
  const clone = cloneEconomySnapshot(snapshot);
  return Object.freeze({
    schemaVersion: 1,
    revision: clone.revision,
    rulesVersion: clone.rulesVersion,
    treasuryBalanceMinor: clone.treasuryBalanceMinor,
    taxPolicy: clone.taxPolicy,
    currentPeriod: clone.currentPeriod,
    previousPeriod: clone.previousPeriod,
    lastDailySettlementTick: macroHourValue(clone.latestCycleSettlementAtMacroHourIndex),
    lastMonthlyCloseTick:
      clone.lastMonthlyCloseAtMacroHourIndex === null
        ? null
        : macroHourValue(clone.lastMonthlyCloseAtMacroHourIndex),
  });
};

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
  const { schemaVersion, lastDailySettlementTick, lastMonthlyCloseTick, ...candidate } =
    input as Record<string, unknown>;
  const latestCycleSettlementAtMacroHourIndex = decodeMacroHourIndex(lastDailySettlementTick);
  const lastMonthlyCloseAtMacroHourIndex =
    lastMonthlyCloseTick === null ? null : decodeMacroHourIndex(lastMonthlyCloseTick);
  if (
    schemaVersion !== 1 ||
    latestCycleSettlementAtMacroHourIndex === null ||
    (lastMonthlyCloseTick !== null && lastMonthlyCloseAtMacroHourIndex === null)
  ) {
    return { ok: false, reason: 'invalid-save' };
  }
  const runtimeCandidate = {
    ...candidate,
    latestCycleSettlementAtMacroHourIndex,
    lastMonthlyCloseAtMacroHourIndex,
  };
  if (!validateEconomySnapshot(runtimeCandidate, rules)) {
    return { ok: false, reason: 'invalid-save' };
  }
  return { ok: true, value: cloneEconomySnapshot(runtimeCandidate) };
}

function decodeMacroHourIndex(value: unknown): MacroHourIndex | null {
  if (typeof value !== 'number') return null;
  try {
    return macroHourIndex(value);
  } catch {
    return null;
  }
}
