import type { TrafficGraph, TrafficSnapshotV2 } from '@web-three-city/traffic-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApplicationFixture } from '../test/application-fixtures.js';

const normalization = vi.hoisted(() => ({ calls: 0 }));

vi.mock('@web-three-city/traffic-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@web-three-city/traffic-core')>();
  return {
    ...actual,
    createTrafficSnapshotV2(input: TrafficSnapshotV2): TrafficSnapshotV2 {
      normalization.calls += 1;
      return actual.createTrafficSnapshotV2(input);
    },
  };
});

import { createTrafficSnapshotV2 } from '@web-three-city/traffic-core';
import { planTrafficTransportTransaction } from './traffic-transport-transaction.js';

const graph: TrafficGraph = Object.freeze({
  sourceRoadRevision: 0,
  sourceBuildingRevision: 0,
  nodes: Object.freeze([]),
  edges: Object.freeze([]),
});

describe('Traffic transport normalization', () => {
  beforeEach(() => {
    normalization.calls = 0;
  });

  it('reuses the canonical advanced snapshot when no terminal trip needs settlement', () => {
    const world = createApplicationFixture({ withCommercialInfrastructure: false });
    const traffic = createTrafficSnapshotV2({
      schemaVersion: 2,
      revision: 1,
      policyVersion: 1,
      graphSourceRoadRevision: 0,
      graphSourceBuildingRevision: 0,
      timeCursor: {
        sourceGameMinute: 480,
        completedTransportQuantaWithinMinute: 0,
        absoluteTransportSecond: 1_920,
        temporalPolicyVersion: 1,
      },
      activeTrips: [],
    });
    normalization.calls = 0;

    const plan = planTrafficTransportTransaction({
      world,
      mobility: world.mobility,
      traffic,
      graph,
    });

    expect(plan.nextWorld.traffic.revision).toBe(traffic.revision + 1);
    expect(normalization.calls).toBe(0);
  });
});
