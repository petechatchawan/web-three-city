import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../../test/application-fixtures.js';
import { CommittedWorldStore, type CommittedWorld } from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';
import { PresentationCoordinator } from './presentation-coordinator.js';
import { DefaultWorldTransactionCoordinator } from './world-transaction-coordinator.js';

function createTraceCoordinator(trace: string[]): PresentationCoordinator {
  return new PresentationCoordinator({
    setReplacingWorld: (value) => trace.push(`replacing:${value}`),
    loadTerrain: () => trace.push('terrain'),
    loadWater: () => trace.push('water'),
    loadGrid: () => trace.push('grid'),
    loadRoads: () => trace.push('roads'),
    loadZones: () => trace.push('zones'),
    loadBuildings: () => trace.push('buildings'),
    rebuildSelection: () => trace.push('selection'),
    refreshTerrainObjects: () => trace.push('refresh'),
  });
}

describe('PresentationCoordinator', () => {
  it('updates presentation adapters only after committed-world publication', () => {
    const before = createApplicationFixture();
    const after = createApplicationFixture({ applicationRevision: 1 });
    const store = new CommittedWorldStore(before);
    const trace: string[] = [];
    const presentation = new PresentationCoordinator({
      setReplacingWorld: (value) => trace.push(`replacing:${value}`),
      loadTerrain: () => {
        expect(store.snapshot().revision).toBe(after.revision);
        trace.push('after-publication');
      },
      loadWater: () => {},
      loadGrid: () => {},
      loadRoads: () => {},
      loadZones: () => {},
      loadBuildings: () => {},
      rebuildSelection: () => {},
      refreshTerrainObjects: () => {},
    });
    const transactions = new DefaultWorldTransactionCoordinator({
      worldStore: store,
      presentation: presentation.completeWorld,
    });

    const result = transactions.publish({
      baseRevision: before.revision,
      baseFingerprint: fingerprintCommittedWorld(before),
      nextWorld: after,
      nextFingerprint: fingerprintCommittedWorld(after),
    });

    expect(result.status).toBe('committed');
    expect(trace).toContain('after-publication');
    expect(trace.indexOf('after-publication')).toBeGreaterThan(trace.indexOf('replacing:true'));
  });

  it('rebuilds every derived presentation root from the committed world after context restoration', () => {
    const world = createApplicationFixture();
    const trace: string[] = [];
    const presentation = createTraceCoordinator(trace);

    presentation.rebuildCommittedWorld(world);

    expect(trace).toEqual([
      'replacing:true',
      'terrain',
      'water',
      'grid',
      'roads',
      'zones',
      'buildings',
      'selection',
      'refresh',
      'replacing:false',
    ]);
  });

  it('does not own or mutate active tool and Undo state during incremental Growth presentation', () => {
    const world: CommittedWorld = createApplicationFixture();
    const state = { tool: 'zone-industrial', undoKind: 'road' };
    const before = { ...state };
    const trace: string[] = [];
    const presentation = createTraceCoordinator(trace);

    presentation.incremental(() => trace.push('building-growth')).synchronize(world);

    expect(state).toEqual(before);
    expect(trace).toEqual(['building-growth']);
  });
});
