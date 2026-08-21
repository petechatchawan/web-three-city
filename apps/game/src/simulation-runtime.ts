import type { SimulationSpeed } from '@web-three-city/simulation-core';

const SPEED_MULTIPLIER: Readonly<Record<SimulationSpeed, number>> = Object.freeze({
  paused: 0,
  normal: 1,
  fast: 2,
  faster: 4,
});
const GAME_MINUTE_MILLISECONDS = 1000;
const TRANSPORT_QUANTA_PER_GAME_MINUTE = 4;
const MAX_GAME_MINUTES_PER_ADVANCE = 4;

export type SimulationRuntimeEvent =
  | Readonly<{ readonly type: 'game-minute' }>
  | Readonly<{ readonly type: 'transport-quantum'; readonly ordinal: 1 | 2 | 3 | 4 }>;

export interface SimulationRuntimeState {
  readonly speed: SimulationSpeed;
  readonly accumulatedMilliseconds: number;
}

export interface SimulationRuntime {
  getState(): SimulationRuntimeState;
  setSpeed(speed: SimulationSpeed): void;
  advance(realDeltaMilliseconds: number, onEvent: (event: SimulationRuntimeEvent) => void): number;
  step(onEvent: (event: SimulationRuntimeEvent) => void): boolean;
  resetAfterVisibilityChange(): void;
}

export function createSimulationRuntime(initialSpeed: SimulationSpeed): SimulationRuntime {
  let speed = initialSpeed;
  let accumulatedMilliseconds = 0;

  return Object.freeze({
    getState(): SimulationRuntimeState {
      return Object.freeze({ speed, accumulatedMilliseconds });
    },
    setSpeed(nextSpeed: SimulationSpeed): void {
      if (!(nextSpeed in SPEED_MULTIPLIER)) {
        throw new RangeError('simulation-runtime:invalid-speed');
      }
      speed = nextSpeed;
      accumulatedMilliseconds = 0;
    },
    advance(
      realDeltaMilliseconds: number,
      onEvent: (event: SimulationRuntimeEvent) => void,
    ): number {
      if (!Number.isFinite(realDeltaMilliseconds) || realDeltaMilliseconds < 0) {
        throw new RangeError('simulation-runtime:invalid-delta');
      }
      if (speed === 'paused') {
        accumulatedMilliseconds = 0;
        return 0;
      }
      accumulatedMilliseconds += realDeltaMilliseconds * SPEED_MULTIPLIER[speed];
      let emitted = 0;
      while (
        accumulatedMilliseconds >= GAME_MINUTE_MILLISECONDS &&
        emitted < MAX_GAME_MINUTES_PER_ADVANCE
      ) {
        accumulatedMilliseconds -= GAME_MINUTE_MILLISECONDS;
        emitGameMinute(onEvent);
        emitted += 1;
      }
      return emitted;
    },
    step(onEvent: (event: SimulationRuntimeEvent) => void): boolean {
      if (speed !== 'paused') return false;
      emitGameMinute(onEvent);
      return true;
    },
    resetAfterVisibilityChange(): void {
      accumulatedMilliseconds = 0;
    },
  });
}

function emitGameMinute(onEvent: (event: SimulationRuntimeEvent) => void): void {
  onEvent(Object.freeze({ type: 'game-minute' }));
  for (let ordinal = 1; ordinal <= TRANSPORT_QUANTA_PER_GAME_MINUTE; ordinal += 1) {
    onEvent(
      Object.freeze({
        type: 'transport-quantum',
        ordinal: ordinal as 1 | 2 | 3 | 4,
      }),
    );
  }
}
