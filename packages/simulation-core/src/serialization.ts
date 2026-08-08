import { createSimulationSnapshot } from './simulation-snapshot.js';
import type { SimulationSnapshot } from './contracts.js';

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

export type SimulationSaveResult =
  | Readonly<{ readonly ok: true; readonly value: SimulationSnapshot }>
  | Readonly<{
      readonly ok: false;
      readonly error: Readonly<{
        readonly code: 'simulation-save:invalid-schema' | 'simulation-save:invalid-state';
      }>;
    }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function encodeSimulationSaveV1(snapshot: SimulationSnapshot): SimulationSaveV1 {
  const validated = createSimulationSnapshot(snapshot);
  return Object.freeze({
    kind: 'simulation-save',
    schemaVersion: 1,
    absoluteTick: validated.absoluteTick,
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
        absoluteTick: input.absoluteTick,
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
    absoluteTick: validated.absoluteTick,
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
        absoluteTick: input.absoluteTick,
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
