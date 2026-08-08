import { describe, expect, it } from 'vitest';
import { createApplicationFixture, MemoryWorldStorage } from '../../test/application-fixtures.js';
import { CommittedWorldStore } from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';
import { SaveCoordinator, WORLD_SAVE_KEY } from './save-coordinator.js';
import { DefaultWorldTransactionCoordinator } from './world-transaction-coordinator.js';

describe('SaveCoordinator', () => {
  it('saves only the coherent committed-world snapshot and loads through one transaction publication', async () => {
    const original = createApplicationFixture({ withCommercialBuilding: true });
    const store = new CommittedWorldStore(original);
    const transactionCoordinator = new DefaultWorldTransactionCoordinator({ worldStore: store });
    const storage = new MemoryWorldStorage();
    const coordinator = new SaveCoordinator({ storage, worldStore: store, transactionCoordinator });

    coordinator.save();
    const raw = storage.read(WORLD_SAVE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.schemaVersion).toBe(6);
    expect(parsed.buildings).toBeDefined();
    expect(parsed.rci).toBeDefined();
    expect(parsed.economy).toBeDefined();

    const empty = createApplicationFixture({ applicationRevision: 1 });
    expect(
      transactionCoordinator.publish({
        baseRevision: original.revision,
        baseFingerprint: fingerprintCommittedWorld(original),
        nextWorld: empty,
        nextFingerprint: fingerprintCommittedWorld(empty),
      }).status,
    ).toBe('committed');

    const loaded = await coordinator.load();
    if (loaded.status === 'rejected') throw new Error(`load-rejected:${loaded.reason}`);
    expect(loaded.status).toBe('committed');
    if (loaded.status === 'committed') {
      expect(loaded.world.revision).toBe(2);
      expect(loaded.world.buildings).toEqual(original.buildings);
      expect(loaded.world.rci).toEqual(original.rci);
      expect(loaded.world.simulation).toEqual(original.simulation);
      expect(loaded.world.economy).toEqual(original.economy);
    }
  });

  it('rejects invalid storage without changing committed authority', async () => {
    const initial = createApplicationFixture();
    const store = new CommittedWorldStore(initial);
    const transactionCoordinator = new DefaultWorldTransactionCoordinator({ worldStore: store });
    const storage = new MemoryWorldStorage();
    storage.write(WORLD_SAVE_KEY, '{invalid-json');
    const coordinator = new SaveCoordinator({ storage, worldStore: store, transactionCoordinator });

    const result = await coordinator.load();
    expect(result.status).toBe('rejected');
    expect(fingerprintCommittedWorld(store.snapshot())).toBe(fingerprintCommittedWorld(initial));
  });
});
