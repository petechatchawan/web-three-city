import { createSimulationSnapshot } from './simulation-snapshot.js';
import type { SimulationSnapshot } from './contracts.js';
import { assertAbsoluteTick, MINUTES_PER_HOUR } from './calendar.js';
import { absoluteGameMinute, gameMinuteValue, type AbsoluteGameMinute } from './temporal-units.js';

export interface SimulationSaveV1 {
  readonly kind: 'simulation-save';
  readonly schemaVersion: 1;
  readonly absoluteTick: number;
  readonly growthSequence: number;
}

export interface SimulationSaveV2 {
  readonly kind: 'simulation-save';
  readonly schemaVersion: 2;
  readonly revision: number;
  readonly absoluteTick: number;
  readonly growthSequence: number;
}

export interface SimulationSaveV3 {
  readonly kind: 'simulation-save';
  readonly schemaVersion: 3;
  readonly revision: number;
  readonly absoluteGameMinute: number;
  readonly growthSequence: number;
}

export type SimulationSaveResult =
  | Readonly<{ readonly ok: true; readonly value: SimulationSnapshot }>
  | Readonly<{
      readonly ok: false;
      readonly error: Readonly<{
        readonly code: 'simulation-save:invalid-schema' | 'simulation-save:invalid-state';
      }>;
    }>;

function absoluteGameMinuteFromLegacyTick(absoluteTick: number): AbsoluteGameMinute {
  assertAbsoluteTick(absoluteTick);
  const absoluteGameMinuteValue = absoluteTick * MINUTES_PER_HOUR;
  if (!Number.isSafeInteger(absoluteGameMinuteValue)) {
    throw new RangeError('simulation-save:minute-overflow');
  }
  return absoluteGameMinute(absoluteGameMinuteValue);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function encodeSimulationSaveV1(snapshot: SimulationSnapshot): SimulationSaveV1 {
  const validated = createSimulationSnapshot(snapshot);
  return Object.freeze({
    kind: 'simulation-save',
    schemaVersion: 1,
    absoluteTick: Math.floor(gameMinuteValue(validated.absoluteGameMinute) / MINUTES_PER_HOUR),
    growthSequence: validated.growthSequence,
  });
}

export function decodeSimulationSaveV1(input: unknown): SimulationSaveResult {
  if (
    !isRecord(input) ||
    input.kind !== 'simulation-save' ||
    input.schemaVersion !== 1 ||
    typeof input.absoluteTick !== 'number' ||
    typeof input.growthSequence !== 'number'
  ) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({ code: 'simulation-save:invalid-schema' }),
    });
  }
  try {
    return Object.freeze({
      ok: true,
      value: createSimulationSnapshot({
        revision: 0,
        absoluteGameMinute: absoluteGameMinuteFromLegacyTick(input.absoluteTick),
        growthSequence: input.growthSequence,
      }),
    });
  } catch {
    return Object.freeze({
      ok: false,
      error: Object.freeze({ code: 'simulation-save:invalid-state' }),
    });
  }
}

export function encodeSimulationSaveV2(snapshot: SimulationSnapshot): SimulationSaveV2 {
  const validated = createSimulationSnapshot(snapshot);
  return Object.freeze({
    kind: 'simulation-save',
    schemaVersion: 2,
    revision: validated.revision,
    absoluteTick: Math.floor(gameMinuteValue(validated.absoluteGameMinute) / MINUTES_PER_HOUR),
    growthSequence: validated.growthSequence,
  });
}

export function decodeSimulationSaveV2(input: unknown): SimulationSaveResult {
  if (
    !isRecord(input) ||
    input.kind !== 'simulation-save' ||
    input.schemaVersion !== 2 ||
    typeof input.revision !== 'number' ||
    typeof input.absoluteTick !== 'number' ||
    typeof input.growthSequence !== 'number'
  ) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({ code: 'simulation-save:invalid-schema' }),
    });
  }
  try {
    return Object.freeze({
      ok: true,
      value: createSimulationSnapshot({
        revision: input.revision,
        absoluteGameMinute: absoluteGameMinuteFromLegacyTick(input.absoluteTick),
        growthSequence: input.growthSequence,
      }),
    });
  } catch {
    return Object.freeze({
      ok: false,
      error: Object.freeze({ code: 'simulation-save:invalid-state' }),
    });
  }
}

export function migrateSimulationSaveV2ToV3(v2: SimulationSaveV2): SimulationSaveV3 {
  return Object.freeze({
    kind: 'simulation-save',
    schemaVersion: 3,
    revision: v2.revision,
    absoluteGameMinute: gameMinuteValue(absoluteGameMinuteFromLegacyTick(v2.absoluteTick)),
    growthSequence: v2.growthSequence,
  });
}

export function encodeSimulationSaveV3(snapshot: SimulationSnapshot): SimulationSaveV3 {
  const validated = createSimulationSnapshot(snapshot);
  return Object.freeze({
    kind: 'simulation-save',
    schemaVersion: 3,
    revision: validated.revision,
    absoluteGameMinute: gameMinuteValue(validated.absoluteGameMinute),
    growthSequence: validated.growthSequence,
  });
}

export function decodeSimulationSaveV3(input: unknown): SimulationSaveResult {
  if (
    !isRecord(input) ||
    input.kind !== 'simulation-save' ||
    input.schemaVersion !== 3 ||
    typeof input.revision !== 'number' ||
    typeof input.absoluteGameMinute !== 'number' ||
    typeof input.growthSequence !== 'number'
  ) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({ code: 'simulation-save:invalid-schema' }),
    });
  }
  try {
    return Object.freeze({
      ok: true,
      value: createSimulationSnapshot({
        revision: input.revision,
        absoluteGameMinute: input.absoluteGameMinute,
        growthSequence: input.growthSequence,
      }),
    });
  } catch {
    return Object.freeze({
      ok: false,
      error: Object.freeze({ code: 'simulation-save:invalid-state' }),
    });
  }
}
