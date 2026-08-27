import { describe, expect, it } from 'vitest';
import { createSimulationRuntime, type SimulationRuntimeEvent } from './simulation-runtime.js';

const ONE_GAME_MINUTE_EVENTS: readonly SimulationRuntimeEvent[] = Object.freeze([
  Object.freeze({ type: 'game-minute' as const }),
  Object.freeze({ type: 'transport-quantum' as const, ordinal: 1 as const }),
  Object.freeze({ type: 'transport-quantum' as const, ordinal: 2 as const }),
  Object.freeze({ type: 'transport-quantum' as const, ordinal: 3 as const }),
  Object.freeze({ type: 'transport-quantum' as const, ordinal: 4 as const }),
]);

function collectAdvanceEvents(
  runtime: ReturnType<typeof createSimulationRuntime>,
  realDeltaMilliseconds: number,
): readonly SimulationRuntimeEvent[] {
  const events: SimulationRuntimeEvent[] = [];
  runtime.advance(realDeltaMilliseconds, (event) => {
    events.push(event);
  });
  return events;
}

function collectStepEvents(
  runtime: ReturnType<typeof createSimulationRuntime>,
): readonly SimulationRuntimeEvent[] {
  const events: SimulationRuntimeEvent[] = [];
  expect(
    runtime.step((event) => {
      events.push(event);
    }),
  ).toBe(true);
  return events;
}

describe('Simulation runtime', () => {
  it.each([
    ['normal', 1000],
    ['fast', 500],
    ['faster', 250],
  ] as const)('emits one minute and four ordered transport quanta at %s speed', (speed, delta) => {
    expect(collectAdvanceEvents(createSimulationRuntime(speed), delta)).toEqual(
      ONE_GAME_MINUTE_EVENTS,
    );
  });

  it('emits no automatic minute or transport event while paused', () => {
    const runtime = createSimulationRuntime('paused');
    expect(collectAdvanceEvents(runtime, 60_000)).toEqual([]);
  });

  it('steps one minute and all four ordered transport quanta only while paused', () => {
    const runtime = createSimulationRuntime('paused');
    expect(collectStepEvents(runtime)).toEqual(ONE_GAME_MINUTE_EVENTS);
    runtime.setSpeed('normal');
    const events: SimulationRuntimeEvent[] = [];
    expect(
      runtime.step((event) => {
        events.push(event);
      }),
    ).toBe(false);
    expect(events).toEqual([]);
  });

  it('stops the staged minute after a transport quantum rejects', () => {
    const runtime = createSimulationRuntime('normal');
    const events: SimulationRuntimeEvent[] = [];

    expect(
      runtime.advance(1000, (event) => {
        events.push(event);
        if (event.type === 'transport-quantum' && event.ordinal === 3) return false;
        return true;
      }),
    ).toBe(1);

    expect(events).toEqual([
      ONE_GAME_MINUTE_EVENTS[0],
      ONE_GAME_MINUTE_EVENTS[1],
      ONE_GAME_MINUTE_EVENTS[2],
      ONE_GAME_MINUTE_EVENTS[3],
    ]);
    expect(runtime.getState()).toMatchObject({
      speed: 'paused',
      status: 'paused-world-rejected',
      accumulatedMilliseconds: 0,
    });
  });

  it('emits the same ordered sequence when a frame is sliced', () => {
    const unsliced = collectAdvanceEvents(createSimulationRuntime('normal'), 1000);
    const slicedRuntime = createSimulationRuntime('normal');
    const sliced = [250, 250, 250, 250].flatMap((delta) =>
      collectAdvanceEvents(slicedRuntime, delta),
    );
    expect(unsliced).toEqual(ONE_GAME_MINUTE_EVENTS);
    expect(sliced).toEqual(unsliced);
  });

  it('retains unprocessed elapsed minutes for bounded later-frame draining', () => {
    const runtime = createSimulationRuntime('normal');
    const events: SimulationRuntimeEvent[] = [];
    runtime.advance(10_000, (event) => {
      events.push(event);
    });
    while (runtime.getState().accumulatedMilliseconds >= 1000) {
      runtime.advance(0, (event) => {
        events.push(event);
      });
    }
    expect(events).toEqual(Array.from({ length: 10 }, () => ONE_GAME_MINUTE_EVENTS).flat());
  });

  it('resets pending wall-clock accumulation after visibility changes', () => {
    const runtime = createSimulationRuntime('normal');
    collectAdvanceEvents(runtime, 250);
    runtime.resetAfterVisibilityChange();
    expect(runtime.getState().accumulatedMilliseconds).toBe(0);
  });

  it('pauses and clears accumulated time when a temporal minute is rejected', () => {
    const runtime = createSimulationRuntime('normal');
    const rejectedHandler = ((event: SimulationRuntimeEvent) => {
      if (event.type === 'game-minute') return false;
      return undefined;
    }) as unknown as Parameters<typeof runtime.advance>[1];

    runtime.advance(750, rejectedHandler);
    runtime.advance(250, rejectedHandler);

    expect(runtime.getState()).toMatchObject({
      speed: 'paused',
      accumulatedMilliseconds: 0,
      status: 'paused-world-rejected',
    });
    expect(runtime.getState().failure).toMatchObject({ kind: 'world-rejected' });
    expect(runtime.advance(10_000, rejectedHandler)).toBe(0);
  });
});
