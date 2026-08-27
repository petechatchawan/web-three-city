import { describe, expect, it } from 'vitest';
import {
  absoluteGameMinute,
  deriveGameCalendarFromGameMinute,
} from '@web-three-city/simulation-core';
import { createSimulationRuntime, type SimulationRuntimeEvent } from './simulation-runtime.js';

const ONE_GAME_MINUTE_EVENTS: readonly SimulationRuntimeEvent[] = Object.freeze([
  Object.freeze({ type: 'game-minute' as const }),
  Object.freeze({ type: 'transport-quantum' as const, ordinal: 1 as const }),
  Object.freeze({ type: 'transport-quantum' as const, ordinal: 2 as const }),
  Object.freeze({ type: 'transport-quantum' as const, ordinal: 3 as const }),
  Object.freeze({ type: 'transport-quantum' as const, ordinal: 4 as const }),
]);

function eventsForMinutes(count: number): readonly SimulationRuntimeEvent[] {
  return Array.from({ length: count }, () => ONE_GAME_MINUTE_EVENTS).flat();
}

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
    ['normal', 500, 1],
    ['normal', 1000, 2],
    ['fast', 250, 1],
    ['fast', 1000, 4],
    ['faster', 125, 1],
    ['faster', 1000, 8],
  ] as const)(
    'emits the target minute sequence for each playback preset',
    (speed, delta, minutes) => {
      expect(collectAdvanceEvents(createSimulationRuntime(speed), delta)).toEqual(
        eventsForMinutes(minutes),
      );
    },
  );

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

  it('stops later minutes when one minute rejects during a multi-minute advance', () => {
    const runtime = createSimulationRuntime('faster');
    const events: SimulationRuntimeEvent[] = [];
    let gameMinuteCount = 0;

    expect(
      runtime.advance(1000, (event) => {
        events.push(event);
        if (event.type === 'game-minute') {
          gameMinuteCount += 1;
          return gameMinuteCount < 3;
        }
        return true;
      }),
    ).toBe(3);

    expect(events).toEqual([
      ...eventsForMinutes(2),
      Object.freeze({ type: 'game-minute' as const }),
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
    expect(unsliced).toEqual(eventsForMinutes(2));
    expect(sliced).toEqual(unsliced);
  });

  it('retains unprocessed elapsed minutes for bounded later-frame draining', () => {
    const runtime = createSimulationRuntime('normal');
    const events: SimulationRuntimeEvent[] = [];
    runtime.advance(10_000, (event) => {
      events.push(event);
    });
    while (runtime.getState().accumulatedMilliseconds >= 500) {
      runtime.advance(0, (event) => {
        events.push(event);
      });
    }
    expect(events).toEqual(eventsForMinutes(20));
  });

  it('caps each advance while retaining the remaining playback budget', () => {
    const runtime = createSimulationRuntime('faster');
    const events: SimulationRuntimeEvent[] = [];

    expect(
      runtime.advance(10_000, (event) => {
        events.push(event);
      }),
    ).toBe(8);
    expect(runtime.getState().accumulatedMilliseconds).toBe(9_000);

    expect(
      runtime.advance(0, (event) => {
        events.push(event);
      }),
    ).toBe(8);
    expect(runtime.getState().accumulatedMilliseconds).toBe(8_000);
    expect(events).toEqual(eventsForMinutes(16));
  });

  it('does not skip calendar boundaries when one advance requests multiple minutes', () => {
    const runtime = createSimulationRuntime('normal');
    let currentMinute = 1_438;
    const calendars: ReturnType<typeof deriveGameCalendarFromGameMinute>[] = [];

    runtime.advance(1_000, (event) => {
      if (event.type === 'game-minute') {
        currentMinute += 1;
        calendars.push(deriveGameCalendarFromGameMinute(absoluteGameMinute(currentMinute)));
      }
    });

    expect(calendars).toEqual([
      { year: 1, month: 1, hour: 23, minute: 59 },
      { year: 1, month: 2, hour: 0, minute: 0 },
    ]);
  });

  it('does not skip the calendar year boundary when one advance requests multiple minutes', () => {
    const runtime = createSimulationRuntime('normal');
    let currentMinute = 17_278;
    const calendars: ReturnType<typeof deriveGameCalendarFromGameMinute>[] = [];

    runtime.advance(1_000, (event) => {
      if (event.type === 'game-minute') {
        currentMinute += 1;
        calendars.push(deriveGameCalendarFromGameMinute(absoluteGameMinute(currentMinute)));
      }
    });

    expect(calendars).toEqual([
      { year: 1, month: 12, hour: 23, minute: 59 },
      { year: 2, month: 1, hour: 0, minute: 0 },
    ]);
  });

  it('resets pending wall-clock accumulation after visibility changes', () => {
    const runtime = createSimulationRuntime('normal');
    collectAdvanceEvents(runtime, 250);
    runtime.resetAfterVisibilityChange();
    expect(runtime.getState().accumulatedMilliseconds).toBe(0);
  });

  it('resets pending wall-clock accumulation when playback speed changes', () => {
    const runtime = createSimulationRuntime('normal');
    collectAdvanceEvents(runtime, 250);
    expect(runtime.getState().accumulatedMilliseconds).toBe(250);

    runtime.setSpeed('fast');

    expect(runtime.getState().accumulatedMilliseconds).toBe(0);
    expect(collectAdvanceEvents(runtime, 250)).toEqual(ONE_GAME_MINUTE_EVENTS);
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
