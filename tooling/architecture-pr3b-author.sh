#!/usr/bin/env bash
set -euo pipefail

git config user.name 'architecture-impl-agent'
git config user.email 'architecture-impl-agent@users.noreply.github.com'
pnpm install --frozen-lockfile
mkdir -p apps/game/src/application apps/game/test

cat > apps/game/test/application-fixtures.ts <<'EOF'
import {
  createBuildingSnapshot,
  createEmptyBuildingSnapshot,
  type ActiveBuildingInstance,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import {
  createFoundationRciRegistries,
  createRciMigrationInventory,
} from '@web-three-city/rci-core';
import { createEmptyRoadSnapshot, type RoadSnapshot } from '@web-three-city/road-core';
import { createInitialSimulationSnapshot } from '@web-three-city/simulation-core';
import { createTerrainMap } from '@web-three-city/terrain-core';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createEmptyZoneSnapshot, type ZoneSnapshot } from '@web-three-city/zone-core';
import { createBuildingDevelopmentEnvironment } from '../src/building-development-environment.js';
import { createBuildingWorldOccupancy } from '../src/building-world-occupancy.js';
import { createCommittedWorld, type CommittedWorld } from '../src/application/committed-world.js';
import { createRoadPlacementEnvironment } from '../src/road-placement-environment.js';
import { createZonePlacementEnvironment } from '../src/zone-placement-environment.js';

function terrain() {
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array(
      (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1),
    ).fill(WORLD_CONFIG.seaLevel + 1),
    seed: 41,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 0,
  });
}

function commercialBuilding(): ActiveBuildingInstance {
  return Object.freeze({
    instanceId: 'building:commercial:1',
    buildingDefinitionId: 'commercial-shop-1x1',
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ x: 4, z: 4 }),
    rotationQuarterTurns: 0,
    lifecycle: 'active',
    activatedAtTick: 0,
  });
}

export function createApplicationFixture(input: {
  applicationRevision?: number;
  withCommercialBuilding?: boolean;
  buildingRevision?: number;
} = {}): CommittedWorld {
  const applicationRevision = input.applicationRevision ?? 0;
  const terrainSnapshot = terrain();
  const waterResult = deriveWaterSnapshot(terrainSnapshot, WORLD_CONFIG);
  if (!waterResult.ok) throw new Error(waterResult.error.code);
  const roadsBase = createEmptyRoadSnapshot(WORLD_CONFIG);
  const roads: RoadSnapshot = Object.freeze({
    width: roadsBase.width,
    height: roadsBase.height,
    revision: roadsBase.revision,
    definitionCodes: roadsBase.definitionCodes,
  });
  const zonesBase = createEmptyZoneSnapshot(WORLD_CONFIG);
  const zones: ZoneSnapshot = Object.freeze({
    width: zonesBase.width,
    height: zonesBase.height,
    revision: zonesBase.revision,
    definitionCodes: zonesBase.definitionCodes,
  });
  const buildings: BuildingSnapshot = input.withCommercialBuilding
    ? createBuildingSnapshot(
        { revision: input.buildingRevision ?? 1, instances: [commercialBuilding()] },
        WORLD_CONFIG,
      )
    : createEmptyBuildingSnapshot(WORLD_CONFIG);
  const simulation = createInitialSimulationSnapshot();
  const rci = createRciMigrationInventory({
    buildings,
    absoluteTick: simulation.absoluteTick,
    registries: createFoundationRciRegistries(),
  });
  const environments = Object.freeze({
    road: createRoadPlacementEnvironment(terrainSnapshot, waterResult.value, WORLD_CONFIG),
    zone: createZonePlacementEnvironment(
      terrainSnapshot,
      waterResult.value,
      roads,
      createBuildingWorldOccupancy(buildings),
      WORLD_CONFIG,
    ),
    building: createBuildingDevelopmentEnvironment(
      terrainSnapshot,
      waterResult.value,
      roads,
      zones,
      WORLD_CONFIG,
    ),
  });
  return createCommittedWorld({
    revision: applicationRevision,
    terrain: terrainSnapshot,
    water: waterResult.value,
    roads,
    zones,
    buildings,
    simulation,
    rci,
    environments,
  });
}

export class MemoryWorldStorage {
  readonly values = new Map<string, string>();
  read(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  write(key: string, value: string): void {
    this.values.set(key, value);
  }
}
EOF

cat > apps/game/src/application/world-transaction-coordinator.test.ts <<'EOF'
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
EOF

cat > apps/game/src/application/save-coordinator.test.ts <<'EOF'
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
    expect(parsed.schemaVersion).toBe(5);
    expect(parsed.buildings).toBeDefined();
    expect(parsed.rci).toBeDefined();

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
    expect(loaded.status).toBe('committed');
    if (loaded.status === 'committed') {
      expect(loaded.world.revision).toBe(2);
      expect(loaded.world.buildings).toEqual(original.buildings);
      expect(loaded.world.rci).toEqual(original.rci);
      expect(loaded.world.simulation).toEqual(original.simulation);
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
    expect(store.snapshot()).toEqual(initial);
  });
});
EOF

cat > apps/game/src/application/undo-coordinator.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../../test/application-fixtures.js';
import { CommittedWorldStore } from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';
import { UndoCoordinator } from './undo-coordinator.js';
import { DefaultWorldTransactionCoordinator } from './world-transaction-coordinator.js';

describe('UndoCoordinator', () => {
  it('restores complete dependent Building and RCI state while advancing only application revision', () => {
    const before = createApplicationFixture({ withCommercialBuilding: true });
    const store = new CommittedWorldStore(before);
    const transactionCoordinator = new DefaultWorldTransactionCoordinator({ worldStore: store });
    const undo = new UndoCoordinator({ transactionCoordinator });
    undo.record(before);
    const removed = createApplicationFixture({ applicationRevision: 1 });
    expect(
      transactionCoordinator.publish({
        baseRevision: before.revision,
        baseFingerprint: fingerprintCommittedWorld(before),
        nextWorld: removed,
        nextFingerprint: fingerprintCommittedWorld(removed),
      }).status,
    ).toBe('committed');

    const result = undo.undo();
    expect(result?.status).toBe('committed');
    if (result?.status === 'committed') {
      expect(result.world.revision).toBe(2);
      expect(result.world.buildings).toEqual(before.buildings);
      expect(result.world.rci).toEqual(before.rci);
      expect(result.world.rci.sequences).toEqual(before.rci.sequences);
    }
    expect(undo.available).toBe(false);
  });

  it('retains the pending entry when publication is rejected', () => {
    const before = createApplicationFixture({ withCommercialBuilding: true });
    const transactionCoordinator = {
      snapshot: () => before,
      publish: () => ({ status: 'rejected' as const, world: before, reason: 'world:stale-content' as const }),
      replaceFromDecodedWorld: () => ({ status: 'rejected' as const, world: before, reason: 'world:stale-content' as const }),
    };
    const undo = new UndoCoordinator({ transactionCoordinator });
    undo.record(before);

    expect(undo.undo()?.status).toBe('rejected');
    expect(undo.available).toBe(true);
  });
});
EOF

set +e
RED_OUTPUT=$(pnpm --filter @web-three-city/game test -- src/application/world-transaction-coordinator.test.ts src/application/save-coordinator.test.ts src/application/undo-coordinator.test.ts 2>&1)
RED_STATUS=$?
set -e
if [ "$RED_STATUS" -eq 0 ]; then echo 'Expected coordinator RED failure.' >&2; exit 1; fi
printf '%s\n' "$RED_OUTPUT"
if ! printf '%s\n' "$RED_OUTPUT" | grep -Eq 'world-transaction-coordinator|save-coordinator|undo-coordinator|Failed to resolve import|Cannot find module'; then
  echo 'Coordinator RED failed for an unexpected reason.' >&2
  exit 1
fi

cat >> apps/game/src/application/committed-world.ts <<'EOF'

export type CommittedDomainState = Readonly<{
  revision: number;
  terrain: TerrainSnapshot;
  roads: RoadSnapshot;
  zones: ZoneSnapshot;
  buildings: BuildingSnapshot;
  simulation: SimulationSnapshot;
  rci: RciSnapshot;
}>;

export function createCommittedWorldFromDomainState(input: CommittedDomainState): CommittedWorld {
  const waterResult = deriveWaterSnapshot(input.terrain, WORLD_CONFIG);
  if (!waterResult.ok) throw new Error(`committed-world:water-derivation:${waterResult.error.code}`);
  const environments = Object.freeze({
    road: createRoadPlacementEnvironment(input.terrain, waterResult.value, WORLD_CONFIG),
    zone: createZonePlacementEnvironment(
      input.terrain,
      waterResult.value,
      input.roads,
      createBuildingWorldOccupancy(input.buildings),
      WORLD_CONFIG,
    ),
    building: createBuildingDevelopmentEnvironment(
      input.terrain,
      waterResult.value,
      input.roads,
      input.zones,
      WORLD_CONFIG,
    ),
  });
  return createCommittedWorld({
    ...input,
    water: waterResult.value,
    environments,
  });
}
EOF

python <<'PY'
from pathlib import Path
p = Path('apps/game/src/application/committed-world.ts')
text = p.read_text()
text = text.replace("import type { WaterSnapshot } from '@web-three-city/water-core';", "import { deriveWaterSnapshot, type WaterSnapshot } from '@web-three-city/water-core';")
p.write_text(text)
PY

cat > apps/game/src/application/world-transaction-coordinator.ts <<'EOF'
import { createFoundationRciRegistries, validateRciSnapshot } from '@web-three-city/rci-core';
import type { DecodedWorldState } from '../world-save.js';
import {
  CommittedWorldStore,
  createCommittedWorld,
  createCommittedWorldFromDomainState,
  type CommittedWorld,
} from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';

export type WorldPublicationRejection =
  | 'world:stale-revision'
  | 'world:stale-content'
  | 'world:invalid-candidate'
  | 'world:no-save'
  | 'world:invalid-save';

export interface WorldPublication {
  readonly baseRevision: number;
  readonly baseFingerprint: string;
  readonly nextWorld: CommittedWorld;
  readonly nextFingerprint: string;
}

export type WorldPublicationResult =
  | Readonly<{
      status: 'rejected';
      world: CommittedWorld;
      reason: WorldPublicationRejection;
    }>
  | Readonly<{
      status: 'committed';
      world: CommittedWorld;
      presentation:
        | Readonly<{ status: 'synchronized' }>
        | Readonly<{ status: 'degraded'; recoveryRequired: true }>;
    }>;

export interface WorldTransactionCoordinator {
  snapshot(): CommittedWorld;
  publish(plan: WorldPublication): WorldPublicationResult;
  replaceFromDecodedWorld(world: DecodedWorldState): WorldPublicationResult;
}

export interface WorldPresentationPort {
  synchronize(world: CommittedWorld): void;
  rebuildFromCommitted(world: CommittedWorld): void;
}

function rejected(world: CommittedWorld, reason: WorldPublicationRejection): WorldPublicationResult {
  return Object.freeze({ status: 'rejected' as const, world, reason });
}

export class DefaultWorldTransactionCoordinator implements WorldTransactionCoordinator {
  readonly #worldStore: CommittedWorldStore;
  readonly #presentation: WorldPresentationPort | null;

  constructor(input: { worldStore: CommittedWorldStore; presentation?: WorldPresentationPort }) {
    this.#worldStore = input.worldStore;
    this.#presentation = input.presentation ?? null;
  }

  snapshot(): CommittedWorld {
    return this.#worldStore.snapshot();
  }

  publish(plan: WorldPublication): WorldPublicationResult {
    const current = this.#worldStore.snapshot();
    const currentFingerprint = fingerprintCommittedWorld(current);
    if (plan.baseRevision !== current.revision) return rejected(current, 'world:stale-revision');
    if (plan.baseFingerprint !== currentFingerprint) return rejected(current, 'world:stale-content');
    const candidateFingerprint = fingerprintCommittedWorld(plan.nextWorld);
    if (plan.nextFingerprint !== candidateFingerprint) return rejected(current, 'world:stale-content');
    if (plan.nextWorld.revision !== current.revision + 1) {
      return rejected(current, 'world:stale-content');
    }

    let candidate: CommittedWorld;
    try {
      candidate = createCommittedWorld(plan.nextWorld);
      const rciValidation = validateRciSnapshot(
        candidate.rci,
        candidate.buildings,
        candidate.simulation,
        createFoundationRciRegistries(),
      );
      if (!rciValidation.valid) return rejected(current, 'world:invalid-candidate');
      candidate = this.#worldStore.replace(current.revision, candidate);
    } catch {
      return rejected(current, 'world:invalid-candidate');
    }

    if (this.#presentation === null) {
      return Object.freeze({
        status: 'committed' as const,
        world: candidate,
        presentation: Object.freeze({ status: 'synchronized' as const }),
      });
    }
    try {
      this.#presentation.synchronize(candidate);
      return Object.freeze({
        status: 'committed' as const,
        world: candidate,
        presentation: Object.freeze({ status: 'synchronized' as const }),
      });
    } catch {
      try {
        this.#presentation.rebuildFromCommitted(candidate);
      } catch {
        // Domain authority is already committed. Recovery can be retried from snapshot().
      }
      return Object.freeze({
        status: 'committed' as const,
        world: candidate,
        presentation: Object.freeze({ status: 'degraded' as const, recoveryRequired: true as const }),
      });
    }
  }

  replaceFromDecodedWorld(world: DecodedWorldState): WorldPublicationResult {
    const current = this.#worldStore.snapshot();
    let candidate: CommittedWorld;
    try {
      candidate = createCommittedWorldFromDomainState({
        revision: current.revision + 1,
        terrain: world.terrain,
        roads: world.roads,
        zones: world.zones,
        buildings: world.buildings,
        simulation: world.simulation,
        rci: world.rci,
      });
    } catch {
      return rejected(current, 'world:invalid-candidate');
    }
    return this.publish({
      baseRevision: current.revision,
      baseFingerprint: fingerprintCommittedWorld(current),
      nextWorld: candidate,
      nextFingerprint: fingerprintCommittedWorld(candidate),
    });
  }
}
EOF

cat > apps/game/src/application/save-coordinator.ts <<'EOF'
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { decodeWorldSave, encodeWorldSaveV5, type WorldSaveV5 } from '../world-save.js';
import type { CommittedWorldStore } from './committed-world.js';
import type {
  WorldPublicationResult,
  WorldStoragePort as Never,
  WorldTransactionCoordinator,
} from './world-transaction-coordinator.js';

export const WORLD_SAVE_KEY = 'web-three-city:world-save:v5';
export const WORLD_SAVE_READ_KEYS = Object.freeze([
  WORLD_SAVE_KEY,
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

  savePayload(): WorldSaveV5 {
    const world = this.#worldStore.snapshot();
    return encodeWorldSaveV5(
      world.terrain,
      world.roads,
      world.zones,
      world.buildings,
      world.simulation,
      world.rci,
    );
  }

  save(): void {
    this.#storage.write(WORLD_SAVE_KEY, JSON.stringify(this.savePayload()));
  }

  async load(): Promise<WorldPublicationResult> {
    const current = this.#worldStore.snapshot();
    const saved = WORLD_SAVE_READ_KEYS.map((key) => this.#storage.read(key)).find(
      (value): value is string => value !== null,
    );
    if (saved === undefined) {
      return Object.freeze({ status: 'rejected' as const, world: current, reason: 'world:no-save' as const });
    }
    try {
      const decoded = decodeWorldSave(JSON.parse(saved) as unknown, WORLD_CONFIG);
      if (!decoded.ok) {
        return Object.freeze({ status: 'rejected' as const, world: current, reason: 'world:invalid-save' as const });
      }
      return this.#transactionCoordinator.replaceFromDecodedWorld(decoded.value);
    } catch {
      return Object.freeze({ status: 'rejected' as const, world: current, reason: 'world:invalid-save' as const });
    }
  }
}
EOF

python <<'PY'
from pathlib import Path
p = Path('apps/game/src/application/save-coordinator.ts')
text = p.read_text().replace(
"import type {\n  WorldPublicationResult,\n  WorldStoragePort as Never,\n  WorldTransactionCoordinator,\n} from './world-transaction-coordinator.js';",
"import type { WorldPublicationResult, WorldTransactionCoordinator } from './world-transaction-coordinator.js';"
)
p.write_text(text)
PY

cat > apps/game/src/application/undo-coordinator.ts <<'EOF'
import {
  createCommittedWorld,
  createCommittedWorldFromDomainState,
  type CommittedWorld,
} from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';
import type { WorldPublicationResult, WorldTransactionCoordinator } from './world-transaction-coordinator.js';

export class UndoCoordinator {
  readonly #transactionCoordinator: WorldTransactionCoordinator;
  #beforeWorld: CommittedWorld | null = null;

  constructor(input: { transactionCoordinator: WorldTransactionCoordinator }) {
    this.#transactionCoordinator = input.transactionCoordinator;
  }

  get available(): boolean {
    return this.#beforeWorld !== null;
  }

  record(world: CommittedWorld): void {
    this.#beforeWorld = createCommittedWorld(world);
  }

  clear(): void {
    this.#beforeWorld = null;
  }

  undo(): WorldPublicationResult | null {
    if (this.#beforeWorld === null) return null;
    const before = this.#beforeWorld;
    const current = this.#transactionCoordinator.snapshot();
    const candidate = createCommittedWorldFromDomainState({
      revision: current.revision + 1,
      terrain: before.terrain,
      roads: before.roads,
      zones: before.zones,
      buildings: before.buildings,
      simulation: before.simulation,
      rci: before.rci,
    });
    const result = this.#transactionCoordinator.publish({
      baseRevision: current.revision,
      baseFingerprint: fingerprintCommittedWorld(current),
      nextWorld: candidate,
      nextFingerprint: fingerprintCommittedWorld(candidate),
    });
    if (result.status === 'committed') this.#beforeWorld = null;
    return result;
  }
}
EOF

pnpm format
pnpm --filter @web-three-city/game test -- src/application/world-transaction-coordinator.test.ts src/application/save-coordinator.test.ts src/application/undo-coordinator.test.ts src/application/committed-world.test.ts src/world-save-v5.test.ts
pnpm --filter @web-three-city/game typecheck

git rm .github/workflows/architecture-pr3b-author.yml tooling/architecture-pr3b-author.sh
git add apps/game/test/application-fixtures.ts apps/game/src/application/committed-world.ts apps/game/src/application/world-transaction-coordinator.ts apps/game/src/application/world-transaction-coordinator.test.ts apps/game/src/application/save-coordinator.ts apps/game/src/application/save-coordinator.test.ts apps/game/src/application/undo-coordinator.ts apps/game/src/application/undo-coordinator.test.ts
git commit -m 'refactor(game): add world publication Save and Undo coordinators'
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git push origin HEAD:refactor/dependent-world-consistency-v0-1
