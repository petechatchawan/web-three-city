import { describe, expect, it, vi } from 'vitest';
import { createSimulationRuntime } from './simulation-runtime.js';

describe('Simulation runtime', () => {
  it('emits deterministic whole ticks for every speed', () => {
    const tick = vi.fn();
    const runtime = createSimulationRuntime('normal');
    for (let index = 0; index < 4; index += 1) runtime.advance(250, tick);
    expect(tick).toHaveBeenCalledTimes(1);
    runtime.setSpeed('fast');
    for (let index = 0; index < 4; index += 1) runtime.advance(250, tick);
    expect(tick).toHaveBeenCalledTimes(3);
    runtime.setSpeed('faster');
    for (let index = 0; index < 4; index += 1) runtime.advance(250, tick);
    expect(tick).toHaveBeenCalledTimes(7);
  });

  it('steps exactly once only while paused and clears hidden-tab accumulation', () => {
    const tick = vi.fn();
    const runtime = createSimulationRuntime('paused');
    expect(runtime.step(tick)).toBe(true);
    expect(tick).toHaveBeenCalledTimes(1);
    runtime.setSpeed('normal');
    expect(runtime.step(tick)).toBe(false);
    runtime.advance(250, tick);
    runtime.resetAfterVisibilityChange();
    expect(runtime.getState().accumulatedMilliseconds).toBe(0);
  });
});
