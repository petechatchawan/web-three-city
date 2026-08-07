import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../../test/application-fixtures.js';
import { CommittedWorldStore } from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';
import { DefaultWorldTransactionCoordinator } from './world-transaction-coordinator.js';

describe('WorldTransactionCoordinator', () => {
  it('rejects stale content without changing committed authority', () => {
    const initial = createApplicationFixture();
    const store = new CommittedWorldStore(initial);
    const coordinator = new DefaultWorldTransactionCoordinator({ worldStore: store });
    const next = createApplicationFixture({ applicationRevision: 1 });
    const before = coordinator.snapshot();

    const result = coordinator.publish({
      baseRevision: before.revision,
      baseFingerprint: 'wrong-fingerprint',
      nextWorld: next,
      nextFingerprint: fingerprintCommittedWorld(next),
    });

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.reason).toBe('world:stale-content');
    expect(coordinator.snapshot()).toEqual(before);
  });

  it('rejects a same-revision different-content candidate as stale content', () => {
    const initial = createApplicationFixture({ withCommercialBuilding: true });
    const store = new CommittedWorldStore(initial);
    const coordinator = new DefaultWorldTransactionCoordinator({ worldStore: store });
    const next = createApplicationFixture({ applicationRevision: 0 });

    const result = coordinator.publish({
      baseRevision: initial.revision,
      baseFingerprint: fingerprintCommittedWorld(initial),
      nextWorld: next,
      nextFingerprint: fingerprintCommittedWorld(next),
    });

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.reason).toBe('world:stale-content');
    expect(coordinator.snapshot().buildings).toEqual(initial.buildings);
  });

  it('rejects invalid Building placement before changing authority', () => {
    const initial = createApplicationFixture();
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(initial),
    });
    const invalid = createApplicationFixture({
      applicationRevision: 1,
      withCommercialBuilding: true,
      withCommercialInfrastructure: false,
    });

    const result = coordinator.publish({
      baseRevision: initial.revision,
      baseFingerprint: fingerprintCommittedWorld(initial),
      nextWorld: invalid,
      nextFingerprint: fingerprintCommittedWorld(invalid),
    });

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.reason).toBe('world:invalid-candidate');
    expect(fingerprintCommittedWorld(coordinator.snapshot())).toBe(
      fingerprintCommittedWorld(initial),
    );
  });

  it('commits once before presentation and never rolls domain authority back on adapter failure', () => {
    const initial = createApplicationFixture();
    const next = createApplicationFixture({ applicationRevision: 1, withCommercialBuilding: true });
    const synchronized: number[] = [];
    const recovered: number[] = [];
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(initial),
      presentation: {
        synchronize(world) {
          synchronized.push(world.revision);
          throw new Error('adapter-failed');
        },
        rebuildFromCommitted(world) {
          recovered.push(world.revision);
        },
      },
    });

    const result = coordinator.publish({
      baseRevision: initial.revision,
      baseFingerprint: fingerprintCommittedWorld(initial),
      nextWorld: next,
      nextFingerprint: fingerprintCommittedWorld(next),
    });

    expect(result.status).toBe('committed');
    if (result.status === 'committed') {
      expect(result.world.revision).toBe(1);
      expect(result.presentation).toEqual({ status: 'degraded', recoveryRequired: true });
    }
    expect(coordinator.snapshot().revision).toBe(1);
    expect(coordinator.snapshot().buildings).toEqual(next.buildings);
    expect(synchronized).toEqual([1]);
    expect(recovered).toEqual([1]);
  });
});
