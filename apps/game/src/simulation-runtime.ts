import type { SimulationSpeed } from '@web-three-city/simulation-core';

const SPEED_MULTIPLIER: Readonly<Record<SimulationSpeed, number>> = Object.freeze({
  paused: 0,
  normal: 1,
  fast: 2,
  faster: 4,
});
const TICK_MILLISECONDS = 1000;
const MAX_FRAME_DELTA_MILLISECONDS = 250;

export interface SimulationRuntimeState {
  readonly speed: SimulationSpeed;
  readonly accumulatedMilliseconds: number;
}

export interface SimulationRuntime {
  getState(): SimulationRuntimeState;
  setSpeed(speed: SimulationSpeed): void;
  advance(realDeltaMilliseconds: number, onTick: () => void): number;
  step(onTick: () => void): boolean;
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
    advance(realDeltaMilliseconds: number, onTick: () => void): number {
      if (!Number.isFinite(realDeltaMilliseconds) || realDeltaMilliseconds < 0) {
        throw new RangeError('simulation-runtime:invalid-delta');
      }
      if (speed === 'paused') {
        accumulatedMilliseconds = 0;
        return 0;
      }
      const acceptedDelta = Math.min(realDeltaMilliseconds, MAX_FRAME_DELTA_MILLISECONDS);
      accumulatedMilliseconds += acceptedDelta * SPEED_MULTIPLIER[speed];
      let emitted = 0;
      while (accumulatedMilliseconds >= TICK_MILLISECONDS) {
        accumulatedMilliseconds -= TICK_MILLISECONDS;
        onTick();
        emitted += 1;
      }
      return emitted;
    },
    step(onTick: () => void): boolean {
      if (speed !== 'paused') return false;
      onTick();
      return true;
    },
    resetAfterVisibilityChange(): void {
      accumulatedMilliseconds = 0;
    },
  });
}
