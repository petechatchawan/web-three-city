import {
  macroHourIndex,
  macroHourValue,
  type MacroHourIndex,
} from '@web-three-city/simulation-core';
import { RciContractError } from '../contracts/errors.js';
import {
  ageOriginMacroHour,
  ageOriginMacroHourValue,
  type AgeOriginMacroHourIndex,
} from '../population/age.js';

const LEGACY_MACRO_HOURS_PER_YEAR = 8_640n;
const NEW_MACRO_HOURS_PER_YEAR = 288n;

function assertSafeInteger(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new RciContractError('rci:invalid-state');
  }
}

function checkedMacroHourValue(value: MacroHourIndex): number {
  const scalar = macroHourValue(value);
  if (!Number.isSafeInteger(scalar) || scalar < 0) {
    throw new RciContractError('rci:invalid-state');
  }
  return scalar;
}

function migrateLegacyAgeOriginValue(
  input: Readonly<{
    legacyBornAtMacroHour: number;
    currentMacroHour: MacroHourIndex;
  }>,
): AgeOriginMacroHourIndex {
  const legacyBornAtMacroHour = input.legacyBornAtMacroHour;
  const currentMacroHour = checkedMacroHourValue(input.currentMacroHour);
  assertSafeInteger(legacyBornAtMacroHour);

  if (legacyBornAtMacroHour > currentMacroHour) {
    throw new RciContractError('rci:invalid-state');
  }

  const legacyElapsed = BigInt(currentMacroHour) - BigInt(legacyBornAtMacroHour);
  const newElapsed = (legacyElapsed * NEW_MACRO_HOURS_PER_YEAR) / LEGACY_MACRO_HOURS_PER_YEAR;
  const newBorn = BigInt(currentMacroHour) - newElapsed;
  if (newBorn < BigInt(Number.MIN_SAFE_INTEGER) || newBorn > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RciContractError('rci:invalid-state');
  }
  return ageOriginMacroHour(Number(newBorn));
}

/**
 * Migrates a legacy non-negative birth point and retains the original Task 3
 * return contract for callers that are migrating cutover data only.
 */
export function migrateLegacyBornAtMacroHour(
  input: Readonly<{
    legacyBornAtMacroHour: number;
    currentMacroHour: MacroHourIndex;
  }>,
): MacroHourIndex {
  if (input.legacyBornAtMacroHour < 0) {
    throw new RciContractError('rci:invalid-state');
  }
  const migrated = migrateLegacyAgeOriginValue(input);
  return macroHourIndex(ageOriginMacroHourValue(migrated));
}

/**
 * Migrates a legacy age origin, including the negative pre-epoch origins
 * used by immigrant citizens. This is intentionally separate from the
 * non-negative MacroHourIndex migration above.
 */
export function migrateLegacyAgeOrigin(
  input: Readonly<{
    legacyBornAtMacroHour: number;
    currentMacroHour: MacroHourIndex;
  }>,
): AgeOriginMacroHourIndex {
  return migrateLegacyAgeOriginValue(input);
}

/**
 * Encodes a compressed runtime age origin back to the legacy V1 coordinate
 * system while that codec remains the active writer. Multiplying the
 * compressed elapsed age by 30 is the exact inverse for integer macro-hours.
 */
export function encodeAgeOriginAsLegacyMacroHour(
  input: Readonly<{
    ageOriginMacroHour: AgeOriginMacroHourIndex;
    currentMacroHour: MacroHourIndex;
  }>,
): number {
  const currentMacroHour = checkedMacroHourValue(input.currentMacroHour);
  const ageOrigin = ageOriginMacroHourValue(input.ageOriginMacroHour);
  if (ageOrigin > currentMacroHour) {
    throw new RciContractError('rci:invalid-state');
  }

  const legacyBorn =
    BigInt(currentMacroHour) -
    (BigInt(currentMacroHour) - BigInt(ageOrigin)) *
      (LEGACY_MACRO_HOURS_PER_YEAR / NEW_MACRO_HOURS_PER_YEAR);
  if (
    legacyBorn < BigInt(Number.MIN_SAFE_INTEGER) ||
    legacyBorn > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new RciContractError('rci:invalid-state');
  }
  return Number(legacyBorn);
}
