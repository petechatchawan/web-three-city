import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../../test/application-fixtures.js';
import { CommittedWorldStore } from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';
import { PresentationCoordinator } from './presentation-coordinator.js';
import { DefaultWorldTransactionCoordinator } from './world-transaction-coordinator.js';

describe('PresentationCoordinator', () => {
  it('updates presentation only after committed-world publication', () => {
    const initial = createApplicationFixture();
    const next = createApplicationFixture({
      applicationRevision: 1,
      withCommercialBuilding: true,
    });
    const store = new CommittedWorldStore(initial);
    const trace: string[] = [];
    const presentation = new PresentationCoordinator({
      steps: [
        (world) => {
          trace.push(`presentation:${store.snapshot().revision}:${world.revision}`);
        },
      ],
    });
    const transaction = new DefaultWorldTransactionCoordinator({
      worldStore: store,
      presentation: presentation.completePort(),
    });

    trace.push(`before:${store.snapshot().revision}`);
    const result = transaction.publish({
      baseRevision: initial.revision,
      baseFingerprint: fingerprintCommittedWorld(initial),
      nextWorld: next,
      nextFingerprint: fingerprintCommittedWorld(next),
    });

    expect(result.status).toBe('committed');
    expect(trace).toEqual(['before:0', 'presentation:1:1']);
  });

  it('rebuilds every registered presentation step from the same committed world', () => {
    const world = createApplicationFixture({ withCommercialBuilding: true });
    const rebuilt: string[] = [];
    const presentation = new PresentationCoordinator({
      steps: ['terrain', 'water', 'grid', 'road', 'zone', 'building', 'selection', 'input'].map(
        (name) => (candidate) => rebuilt.push(`${name}:${candidate.revision}`),
      ),
    });

    presentation.rebuildFromCommitted(world);

    expect(rebuilt).toEqual([
      'terrain:0',
      'water:0',
      'grid:0',
      'road:0',
      'zone:0',
      'building:0',
      'selection:0',
      'input:0',
    ]);
  });

  it('keeps tool and Undo ownership untouched during incremental background presentation', () => {
    const world = createApplicationFixture({ withCommercialBuilding: true });
    const interactionState = { tool: 'zone-industrial', undoKind: 'zone' } as const;
    const before = { ...interactionState };
    const synchronized: number[] = [];
    const presentation = new PresentationCoordinator({ steps: [] });

    presentation
      .incrementalPort((candidate) => synchronized.push(candidate.revision))
      .synchronize(world);

    expect(synchronized).toEqual([0]);
    expect(interactionState).toEqual(before);
  });

  it('always releases full-world synchronization lifecycle state after adapter failure', () => {
    const world = createApplicationFixture();
    let replacing = false;
    const presentation = new PresentationCoordinator({
      beforeSynchronize: () => {
        replacing = true;
      },
      steps: [
        () => {
          throw new Error('presentation-failed');
        },
      ],
      afterSynchronize: () => {
        replacing = false;
      },
    });

    expect(() => presentation.synchronizeCommittedWorld(world)).toThrow('presentation-failed');
    expect(replacing).toBe(false);
  });
});
