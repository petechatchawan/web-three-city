import { describe, expect, it } from 'vitest';
import { createApplicationFixture, MemoryWorldStorage } from '../../test/application-fixtures.js';
import { CommittedWorldStore } from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';
import { SaveCoordinator, WORLD_SAVE_KEY, WORLD_SAVE_READ_KEYS } from './save-coordinator.js';
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
    expect(parsed.schemaVersion).toBe(8);
    expect(parsed.buildings).toBeDefined();
    expect(parsed.rci).toBeDefined();
    expect(parsed.economy).toBeDefined();
    expect(parsed.mobility).toBeDefined();
    expect(parsed.traffic).toBeDefined();

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
      expect(loaded.world.mobility).toEqual(original.mobility);
      expect(loaded.world.traffic).toMatchObject({
        schemaVersion: 2,
        revision: original.traffic.revision,
        graphSourceRoadRevision: original.traffic.graphSourceRoadRevision,
        graphSourceBuildingRevision: original.traffic.graphSourceBuildingRevision,
        activeTrips: original.traffic.activeTrips,
        timeCursor: {
          sourceGameMinute: original.simulation.absoluteGameMinute,
          completedTransportQuantaWithinMinute: 0,
          absoluteTransportSecond: original.simulation.absoluteGameMinute * 4,
        },
      });
    }
  });

  it('writes V8 and discovers a legacy V7 payload when no V8 save is present', async () => {
    expect(WORLD_SAVE_KEY).toBe('web-three-city:world-save:v8');
    expect(WORLD_SAVE_READ_KEYS).toContain('web-three-city:world-save:v7');
    const original = createApplicationFixture({ withCommercialBuilding: true });
    const sourceStore = new CommittedWorldStore(original);
    const sourceTransactions = new DefaultWorldTransactionCoordinator({ worldStore: sourceStore });
    const sourceStorage = new MemoryWorldStorage();
    const source = new SaveCoordinator({
      storage: sourceStorage,
      worldStore: sourceStore,
      transactionCoordinator: sourceTransactions,
    });
    source.save();
    const v8 = sourceStorage.read(WORLD_SAVE_KEY);
    expect(v8).not.toBeNull();
    if (v8 === null) return;

    const legacyPayload = { ...JSON.parse(v8), schemaVersion: 7 };
    legacyPayload.simulation = {
      ...legacyPayload.simulation,
      schemaVersion: 2,
      absoluteTick: Math.floor(legacyPayload.simulation.absoluteGameMinute / 60),
    };
    legacyPayload.mobility = { ...legacyPayload.mobility, schemaVersion: 1, policyVersion: 1 };
    legacyPayload.traffic = {
      ...legacyPayload.traffic,
      schemaVersion: 1,
    };
    delete legacyPayload.traffic.timeCursor;
    const storage = new MemoryWorldStorage();
    storage.write('web-three-city:world-save:v7', JSON.stringify(legacyPayload));
    const targetStore = new CommittedWorldStore(
      createApplicationFixture({ applicationRevision: 1 }),
    );
    const coordinator = new SaveCoordinator({
      storage,
      worldStore: targetStore,
      transactionCoordinator: new DefaultWorldTransactionCoordinator({ worldStore: targetStore }),
    });

    const loaded = await coordinator.load();
    expect(loaded.status).toBe('committed');
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
