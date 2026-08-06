import { describe, expect, it } from 'vitest';
import {
  DETERMINISTIC_SAMPLE_ALGORITHM,
  PROBABILITY_SCALE,
  deterministicSample,
} from '../src/index.js';

describe('RCI deterministic counter-based sampling', () => {
  it('locks canonical FNV-1a v1 golden vectors', () => {
    expect(DETERMINISTIC_SAMPLE_ALGORITHM).toBe('fnv1a32-null-delimited-v1');
    expect(
      deterministicSample({
        seed: 1,
        eventType: 'birth',
        evaluationTick: 32,
        entityStableId: 'citizen:1',
        attemptIndex: 0,
      }),
    ).toBe(754_978_367);
    expect(
      deterministicSample({
        seed: 1,
        eventType: 'death',
        evaluationTick: 32,
        entityStableId: 'citizen:1',
        attemptIndex: 0,
      }),
    ).toBe(546_120_810);
    expect(
      deterministicSample({
        seed: 42,
        eventType: 'qualification',
        evaluationTick: 8_640,
        entityStableId: 'citizen:12',
        attemptIndex: 1,
      }),
    ).toBe(680_176_782);
    expect(
      deterministicSample({
        seed: 42,
        eventType: 'qualification',
        evaluationTick: 8_640,
        entityStableId: 'ประชาชน:12',
        attemptIndex: 1,
      }),
    ).toBe(235_341_119);
  });

  it('keeps samples inside the integer probability domain', () => {
    const sample = deterministicSample({
      seed: 0,
      eventType: 'sex',
      evaluationTick: 0,
      entityStableId: 'citizen:0',
      attemptIndex: 0,
    });
    expect(sample).toBe(179_094_913);
    expect(sample).toBeGreaterThanOrEqual(0);
    expect(sample).toBeLessThan(PROBABILITY_SCALE);
  });

  it('is independent of caller array order', () => {
    const citizens = ['citizen:3', 'citizen:1', 'citizen:2'];
    const sample = (citizenId: string) =>
      deterministicSample({
        seed: 7,
        eventType: 'mortality',
        evaluationTick: 32,
        entityStableId: citizenId,
        attemptIndex: 0,
      });
    const first = new Map(citizens.map((citizenId) => [citizenId, sample(citizenId)]));
    const second = new Map(
      [...citizens].reverse().map((citizenId) => [citizenId, sample(citizenId)]),
    );
    expect([...first].sort()).toEqual([...second].sort());
  });
});
