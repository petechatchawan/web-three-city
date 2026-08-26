declare const absoluteGameMinuteBrand: unique symbol;
declare const gameMinuteDurationBrand: unique symbol;
declare const macroHourIndexBrand: unique symbol;
declare const macroHourDurationBrand: unique symbol;

export type AbsoluteGameMinute = number & {
  readonly [absoluteGameMinuteBrand]: 'AbsoluteGameMinute';
};

export type GameMinuteDuration = number & {
  readonly [gameMinuteDurationBrand]: 'GameMinuteDuration';
};

export type MacroHourIndex = number & {
  readonly [macroHourIndexBrand]: 'MacroHourIndex';
};

export type MacroHourDuration = number & {
  readonly [macroHourDurationBrand]: 'MacroHourDuration';
};

function assertTemporalScalar(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('simulation-temporal:invalid-value');
  }
}

export function absoluteGameMinute(value: number): AbsoluteGameMinute {
  assertTemporalScalar(value);
  return value as AbsoluteGameMinute;
}

export function gameMinuteDuration(value: number): GameMinuteDuration {
  assertTemporalScalar(value);
  return value as GameMinuteDuration;
}

export function macroHourIndex(value: number): MacroHourIndex {
  assertTemporalScalar(value);
  return value as MacroHourIndex;
}

export function macroHourDuration(value: number): MacroHourDuration {
  assertTemporalScalar(value);
  return value as MacroHourDuration;
}

export function gameMinuteValue(value: AbsoluteGameMinute | GameMinuteDuration): number {
  return value;
}

export function macroHourValue(value: MacroHourIndex | MacroHourDuration): number {
  return value;
}

export function addGameMinutes(
  point: AbsoluteGameMinute,
  duration: GameMinuteDuration,
): AbsoluteGameMinute {
  return absoluteGameMinute(gameMinuteValue(point) + gameMinuteValue(duration));
}

export function addMacroHours(point: MacroHourIndex, duration: MacroHourDuration): MacroHourIndex {
  return macroHourIndex(macroHourValue(point) + macroHourValue(duration));
}

export function compareGameMinutes(a: AbsoluteGameMinute, b: AbsoluteGameMinute): -1 | 0 | 1 {
  const left = gameMinuteValue(a);
  const right = gameMinuteValue(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareMacroHours(a: MacroHourIndex, b: MacroHourIndex): -1 | 0 | 1 {
  const left = macroHourValue(a);
  const right = macroHourValue(b);
  return left < right ? -1 : left > right ? 1 : 0;
}
