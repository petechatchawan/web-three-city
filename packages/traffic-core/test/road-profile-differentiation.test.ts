import { describe, expect, it } from 'vitest';
import { resolveTrafficRoadProfile } from '../src/index.js';

describe('PR3 differentiated Traffic Road profiles', () => {
  it('maps Local, Collector, and Arterial to increasing free-flow speed and capacity', () => {
    const local = resolveTrafficRoadProfile(1);
    const collector = resolveTrafficRoadProfile(2);
    const arterial = resolveTrafficRoadProfile(3);

    expect([
      local.freeFlowSpeedMillimetersPerSecond,
      collector.freeFlowSpeedMillimetersPerSecond,
      arterial.freeFlowSpeedMillimetersPerSecond,
    ]).toEqual([8_333, 13_889, 19_444]);

    expect(local.edgeCapacityUnits).toBeLessThan(collector.edgeCapacityUnits);
    expect(collector.edgeCapacityUnits).toBeLessThan(arterial.edgeCapacityUnits);
  });
});
