import { WORLD_CONFIG } from '@web-three-city/world-core';
import { decodeWorldSave, encodeWorldSaveV8, type WorldSaveV8 } from '../world-save.js';
import type { CommittedWorldStore } from './committed-world.js';
import type {
  WorldPublicationResult,
  WorldTransactionCoordinator,
} from './world-transaction-coordinator.js';

export const WORLD_SAVE_KEY = 'web-three-city:world-save:v8';
export const WORLD_SAVE_READ_KEYS = Object.freeze([
  WORLD_SAVE_KEY,
  'web-three-city:world-save:v7',
  'web-three-city:world-save:v6',
  'web-three-city:world-save:v5',
  'web-three-city:world-save:v3',
  'web-three-city:world-save:v2',
  'web-three-city:world-save:v1',
  'web-three-city:terrain-save:v1',
]);

export interface WorldStoragePort {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

export interface SaveCoordinatorDependencies {
  readonly storage: WorldStoragePort;
  readonly worldStore: CommittedWorldStore;
  readonly transactionCoordinator: WorldTransactionCoordinator;
}

export class SaveCoordinator {
  readonly #storage: WorldStoragePort;
  readonly #worldStore: CommittedWorldStore;
  readonly #transactionCoordinator: WorldTransactionCoordinator;

  constructor(input: SaveCoordinatorDependencies) {
    this.#storage = input.storage;
    this.#worldStore = input.worldStore;
    this.#transactionCoordinator = input.transactionCoordinator;
  }

  savePayload(): WorldSaveV8 {
    const world = this.#worldStore.snapshot();
    return encodeWorldSaveV8(
      world.terrain,
      world.roads,
      world.zones,
      world.buildings,
      world.simulation,
      world.rci,
      world.economy,
      world.mobility,
      world.traffic,
    );
  }

  save(): void {
    this.#storage.write(WORLD_SAVE_KEY, JSON.stringify(this.savePayload()));
  }

  load(): WorldPublicationResult {
    const current = this.#worldStore.snapshot();
    const saved = WORLD_SAVE_READ_KEYS.map((key) => this.#storage.read(key)).find(
      (value): value is string => value !== null,
    );
    if (saved === undefined) {
      return Object.freeze({
        status: 'rejected' as const,
        world: current,
        reason: 'world:no-save' as const,
      });
    }
    try {
      const decoded = decodeWorldSave(JSON.parse(saved) as unknown, WORLD_CONFIG);
      if (!decoded.ok) {
        return Object.freeze({
          status: 'rejected' as const,
          world: current,
          reason: 'world:invalid-save' as const,
        });
      }
      return this.#transactionCoordinator.replaceFromDecodedWorld(decoded.value);
    } catch {
      return Object.freeze({
        status: 'rejected' as const,
        world: current,
        reason: 'world:invalid-save' as const,
      });
    }
  }
}
