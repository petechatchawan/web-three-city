import {
  macroHourIndex,
  macroHourValue,
  type MacroHourIndex,
} from '@web-three-city/simulation-core';
import { RciContractError } from '../contracts/errors.js';

const LEGACY_MACRO_HOURS_PER_YEAR = 8_640n;
const NEW_MACRO_HOURS_PER_YEAR = 288n;

function assertNonNegativeSafeInteger(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RciContractError('rci:invalid-state');
  }
}

function checkedMacroHourValue(value: MacroHourIndex): number {
  const scalar = macroHourValue(value);
  assertNonNegativeSafeInteger(scalar);
  return scalar;
}

export function migrateLegacyBornAtMacroHour(
  input: Readonly<{
    legacyBornAtMacroHour: number;
    currentMacroHour: MacroHourIndex;
  }>,
): MacroHourIndex {
  const legacyBornAtMacroHour = input.legacyBornAtMacroHour;
  const currentMacroHour = checkedMacroHourValue(input.currentMacroHour);
  assertNonNegativeSafeInteger(legacyBornAtMacroHour);

  if (legacyBornAtMacroHour > currentMacroHour) {
    throw new RciContractError('rci:invalid-state');
  }

  const legacyElapsed = currentMacroHour - legacyBornAtMacroHour;
  assertNonNegativeSafeInteger(legacyElapsed);

  const newElapsed =
    (BigInt(legacyElapsed) * NEW_MACRO_HOURS_PER_YEAR) / LEGACY_MACRO_HOURS_PER_YEAR;
  if (newElapsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RciContractError('rci:invalid-state');
  }

  const newBorn = currentMacroHour - Number(newElapsed);
  assertNonNegativeSafeInteger(newBorn);
  return macroHourIndex(newBorn);
}
