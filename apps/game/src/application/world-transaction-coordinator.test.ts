import { createEmptyBuildingSnapshot } from '@web-three-city/building-core';
import { createFoundationRciRegistries, createInitialRciSnapshot } from '@web-three-city/rci-core';
import {
  commitRoadMutation,
  createEmptyRoadSnapshot,
  planRoadMutation,
} from '@web-three-city/road-core';
import { createInitialSimulationSnapshot } from '@web-three-city/simulation-core';
import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createEmptyZoneSnapshot } from '@web-three-city/zone-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../../test/application-fixtures.js';
import {
  CommittedWorldStore,
  createCommittedWorldFromDomainState,
} from './committed-world.js';
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

  it('publishes valid Road additions on the curated runtime terrain', () => {
    const generated = generateCoastalTerrain({ seed: 1_464_156_977, config: WORLD_CONFIG });
    if (!generated.ok) throw new Error(generated.error.code);
    const simulation = createInitialSimulationSnapshot();
    const initial = createCommittedWorldFromDomainState({
      revision: 0,
      terrain: generated.value,
      roads: createEmptyRoadSnapshot(WORLD_CONFIG),
      zones: createEmptyZoneSnapshot(WORLD_CONFIG),
      buildings: createEmptyBuildingSnapshot(WORLD_CONFIG),
      simulation,
      rci: createInitialRciSnapshot({ absoluteTick: simulation.absoluteTick }),
    });
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(initial),
    });

    for (let publicationIndex = 0; publicationIndex < 2; publicationIndex += 1) {
      const before = coordinator.snapshot();
      let plan = null as ReturnType<typeof planRoadMutation> | null;
      for (let z = 8 + publicationIndex * 8; z < WORLD_CONFIG.mapHeight - 2 && plan === null; z += 1) {
        for (let x = 8; x < WORLD_CONFIG.mapWidth - 2; x += 1) {
          const candidate = planRoadMutation(
            before.roads,
            {
              operation: 'build',
              definitionId: 'basic-road',
              cells: [
                { x, z },
                { x: x + 1, z },
              ],
            },
            before.environments.road,
            WORLD_CONFIG,
          );
          if (candidate.valid) {
            plan = candidate;
            break;
          }
        }
      }
      if (plan === null) throw new Error('test:no-valid-road-plan');
      const committed = commitRoadMutation(
        before.roads,
        plan,
        before.environments.road,
        WORLD_CONFIG,
      );
      const next = createCommittedWorldFromDomainState({
        revision: before.revision + 1,
        terrain: before.terrain,
        roads: committed.snapshot,
        zones: before.zones,
        buildings: before.buildings,
        simulation: before.simulation,
        rci: before.rci,
      });

      const result = coordinator.publish({
        baseRevision: before.revision,
        baseFingerprint: fingerprintCommittedWorld(before),
        nextWorld: next,
        nextFingerprint: fingerprintCommittedWorld(next),
      });

      expect(result.status).toBe('committed');
    }
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
