import type { SimulationSpeed } from '@web-three-city/simulation-core';
import { TRANSPORT_QUANTA_PER_GAME_MINUTE } from '@web-three-city/traffic-core';

const PLAYBACK_GAME_MINUTES_PER_SECOND: Readonly<Record<SimulationSpeed, number>> = Object.freeze({
  paused: 0,
  normal: 2,
  fast: 4,
  faster: 8,
});
const GAME_MINUTE_MILLISECONDS = 1000;
const MAX_GAME_MINUTES_PER_ADVANCE = 8;

export type SimulationRuntimeEvent =
  | Readonly<{ readonly type: 'game-minute' }>
  | Readonly<{ readonly type: 'transport-quantum'; readonly ordinal: 1 | 2 | 3 | 4 }>;

export interface SimulationRuntimeFailure {
  readonly kind: 'world-rejected';
  readonly phase?: string;
  readonly reason?: string;
}

export type SimulationRuntimeEventResult =
  | void
  | boolean
  | Readonly<{ readonly accepted: boolean; readonly failure?: SimulationRuntimeFailure }>;

export type SimulationRuntimeEventHandler = (
  event: SimulationRuntimeEvent,
) => SimulationRuntimeEventResult;

export type SimulationRuntimeStatus = 'running' | 'paused' | 'paused-world-rejected';

export interface SimulationRuntimeState {
  readonly speed: SimulationSpeed;
  readonly accumulatedMilliseconds: number;
  readonly status: SimulationRuntimeStatus;
  readonly failure: SimulationRuntimeFailure | null;
}

export interface SimulationRuntime {
  getState(): SimulationRuntimeState;
  setSpeed(speed: SimulationSpeed): void;
  advance(realDeltaMilliseconds: number, onEvent: SimulationRuntimeEventHandler): number;
  step(onEvent: SimulationRuntimeEventHandler): boolean;
  resetAfterVisibilityChange(): void;
}

export function createSimulationRuntime(initialSpeed: SimulationSpeed): SimulationRuntime {
  let speed = initialSpeed;
  let accumulatedMilliseconds = 0;
  let status: SimulationRuntimeStatus = initialSpeed === 'paused' ? 'paused' : 'running';
  let failure: SimulationRuntimeFailure | null = null;

  return Object.freeze({
    getState(): SimulationRuntimeState {
      return Object.freeze({ speed, accumulatedMilliseconds, status, failure });
    },
    setSpeed(nextSpeed: SimulationSpeed): void {
      if (!(nextSpeed in PLAYBACK_GAME_MINUTES_PER_SECOND)) {
        throw new RangeError('simulation-runtime:invalid-speed');
      }
      speed = nextSpeed;
      accumulatedMilliseconds = 0;
      status = nextSpeed === 'paused' ? 'paused' : 'running';
      failure = null;
    },
    advance(realDeltaMilliseconds: number, onEvent: SimulationRuntimeEventHandler): number {
      if (!Number.isFinite(realDeltaMilliseconds) || realDeltaMilliseconds < 0) {
        throw new RangeError('simulation-runtime:invalid-delta');
      }
      if (speed === 'paused') {
        accumulatedMilliseconds = 0;
        return 0;
      }
      accumulatedMilliseconds += realDeltaMilliseconds;
      const millisecondsPerGameMinute =
        GAME_MINUTE_MILLISECONDS / PLAYBACK_GAME_MINUTES_PER_SECOND[speed];
      let emitted = 0;
      while (
        accumulatedMilliseconds >= millisecondsPerGameMinute &&
        emitted < MAX_GAME_MINUTES_PER_ADVANCE
      ) {
        accumulatedMilliseconds -= millisecondsPerGameMinute;
        const accepted = emitGameMinute(onEvent);
        emitted += 1;
        if (!accepted.accepted) {
          speed = 'paused';
          status = 'paused-world-rejected';
          accumulatedMilliseconds = 0;
          failure = accepted.failure;
          break;
        }
      }
      return emitted;
    },
    step(onEvent: SimulationRuntimeEventHandler): boolean {
      if (speed !== 'paused') return false;
      const accepted = emitGameMinute(onEvent);
      if (accepted.accepted) {
        status = 'paused';
        failure = null;
      } else {
        status = 'paused-world-rejected';
        failure = accepted.failure;
        accumulatedMilliseconds = 0;
      }
      return accepted.accepted;
    },
    resetAfterVisibilityChange(): void {
      accumulatedMilliseconds = 0;
    },
  });
}

function eventResult(result: SimulationRuntimeEventResult): {
  readonly accepted: boolean;
  readonly failure: SimulationRuntimeFailure | null;
} {
  if (result === false) return { accepted: false, failure: { kind: 'world-rejected' } };
  if (result === undefined || result === true) {
    return { accepted: true, failure: null };
  }
  return {
    accepted: result.accepted,
    failure: result.failure ?? (result.accepted ? null : { kind: 'world-rejected' }),
  };
}

function emitGameMinute(onEvent: SimulationRuntimeEventHandler): {
  readonly accepted: boolean;
  readonly failure: SimulationRuntimeFailure | null;
} {
  const minute = eventResult(onEvent(Object.freeze({ type: 'game-minute' })));
  if (!minute.accepted) return minute;
  for (let ordinal = 1; ordinal <= TRANSPORT_QUANTA_PER_GAME_MINUTE; ordinal += 1) {
    const quantum = eventResult(
      onEvent(
        Object.freeze({
          type: 'transport-quantum',
          ordinal: ordinal as 1 | 2 | 3 | 4,
        }),
      ),
    );
    if (!quantum.accepted) return quantum;
  }
  return { accepted: true, failure: null };
}
