import { describe, expect, it } from 'vitest';
import {
  COMPRESSED_CALENDAR_POLICY_VERSION,
  GAME_MINUTES_PER_HOUR,
  HOURS_PER_SIMULATION_CYCLE,
  MONTHS_PER_CALENDAR_YEAR,
} from '../src/index.js';

describe('compressed calendar policy', () => {
  it('publishes the approved version and unit constants', () => {
    expect(COMPRESSED_CALENDAR_POLICY_VERSION).toBe(1);
    expect(GAME_MINUTES_PER_HOUR).toBe(60);
    expect(HOURS_PER_SIMULATION_CYCLE).toBe(24);
    expect(MONTHS_PER_CALENDAR_YEAR).toBe(12);
  });
});
