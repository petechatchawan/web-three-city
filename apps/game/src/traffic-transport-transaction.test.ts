import { createTrafficSnapshot } from '@web-three-city/traffic-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../test/application-fixtures.js';
import { CommittedWorldStore } from './application/committed-world.js';
import { fingerprintCommittedWorld } from './application/committed-world-fingerprint.js';
import { DefaultWorldTransactionCoordinator } from './application/world-transaction-coordinator.js';
import {
  commitTrafficTransportTransaction,
  planTrafficTransportTransaction,
} from './traffic-transport-transaction.js';

describe('Traffic transport transaction', () => {
  it('publishes Traffic and Mobility atomically without advancing the simulation minute', () => {
    const before = createApplicationFixture();
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(before),
    });
    const plan = planTrafficTransportTransaction({
      world: before,
      traffic: createTrafficSnapshot({ ...before.traffic, revision: before.traffic.revision + 1 }),
      mobility: before.mobility,
    });

    const committed = commitTrafficTransportTransaction(coordinator, plan);

    expect(committed.status).toBe('committed');
    if (committed.status !== 'committed') return;
    expect(committed.world.revision).toBe(before.revision + 1);
    expect(committed.world.simulation).toEqual(before.simulation);
    expect(committed.world.traffic.revision).toBe(before.traffic.revision + 1);
  });

  it('leaves the committed fingerprint unchanged when its staged candidate is invalid', () => {
    const before = createApplicationFixture();
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(before),
    });
    const plan = planTrafficTransportTransaction({
      world: before,
      traffic: createTrafficSnapshot({
        ...before.traffic,
        revision: before.traffic.revision + 1,
        graphSourceRoadRevision: before.roads.revision + 1,
      }),
      mobility: before.mobility,
    });

    expect(commitTrafficTransportTransaction(coordinator, plan)).toMatchObject({
      status: 'rejected',
      reason: 'world:invalid-candidate',
    });
    expect(fingerprintCommittedWorld(coordinator.snapshot())).toBe(
      fingerprintCommittedWorld(before),
    );
  });
});
