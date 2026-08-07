#!/usr/bin/env bash
set -euo pipefail

git config user.name 'architecture-impl-agent'
git config user.email 'architecture-impl-agent@users.noreply.github.com'
pnpm install --frozen-lockfile

cat > apps/game/src/application/rci-building-reconciliation.test.ts <<'EOF'
import { createEmptyBuildingSnapshot } from '@web-three-city/building-core';
import { createFoundationRciRegistries } from '@web-three-city/rci-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../../test/application-fixtures.js';
import { reconcileRciForBuildingChange } from './rci-building-reconciliation.js';

describe('reconcileRciForBuildingChange', () => {
  it('retires workplace inventory before a bulldozed commercial Building can publish', () => {
    const before = createApplicationFixture({ withCommercialBuilding: true });
    const afterBuildings = createEmptyBuildingSnapshot(WORLD_CONFIG);
    expect(before.rci.employment.workplaces.some((workplace) => workplace.retiredAtTick === null)).toBe(
      true,
    );

    const reconciled = reconcileRciForBuildingChange({
      rci: before.rci,
      buildingsBefore: before.buildings,
      buildingsAfter: afterBuildings,
      registries: createFoundationRciRegistries(),
      evaluationTick: before.simulation.absoluteTick,
    });

    expect(reconciled.employment.workplaces).toHaveLength(1);
    expect(reconciled.employment.workplaces[0]?.retiredAtTick).toBe(before.simulation.absoluteTick);
  });
});
EOF

cat > apps/game/src/game-bootstrap-authority.test.ts <<'EOF'
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./game-bootstrap.ts', import.meta.url), 'utf8');

function section(start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`missing bootstrap section: ${start}`);
  return source.slice(from, to);
}

describe('game bootstrap authority migration', () => {
  it('does not own raw persistence or the legacy per-domain Undo store', () => {
    expect(source).not.toMatch(/encodeWorldSaveV5|decodeWorldSave|WorldUndoStore|WorldUndoEntry/);
    expect(source).toMatch(/SaveCoordinator/);
    expect(source).toMatch(/UndoCoordinator/);
  });

  it('routes every interactive mutation through committed-world publication', () => {
    expect(section('const applyTerraformPlan', 'const applyRoadPlan')).toMatch(/publishCommittedDomain/);
    expect(section('const applyRoadPlan', 'const applyZonePlan')).toMatch(/publishCommittedDomain/);
    expect(section('const applyZonePlan', 'const commitBuildingBulldozePlan')).toMatch(
      /publishCommittedDomain/,
    );
    expect(section('const commitBuildingBulldozePlan', 'const applyBuildingBulldozeRequest')).toMatch(
      /publishCommittedDomain/,
    );
  });

  it('routes foreground/background simulation mutation through committed-world publication', () => {
    expect(section('const runBackgroundGrowthTick', 'const runSimulationOnlyTick')).toMatch(
      /publishCommittedDomain/,
    );
    expect(section('const runSimulationOnlyTick', 'const resetCamera')).toMatch(/publishCommittedDomain/);
  });
});
EOF

set +e
RED_OUTPUT=$(pnpm --filter @web-three-city/game test -- src/application/rci-building-reconciliation.test.ts src/game-bootstrap-authority.test.ts 2>&1)
RED_STATUS=$?
set -e
if [ "$RED_STATUS" -eq 0 ]; then echo 'Expected PR3 runtime authority RED failure.' >&2; exit 1; fi
printf '%s\n' "$RED_OUTPUT"
if ! printf '%s\n' "$RED_OUTPUT" | grep -Eq 'rci-building-reconciliation|SaveCoordinator|publishCommittedDomain|Failed to resolve import|Cannot find module'; then
  echo 'PR3 runtime RED failed for an unexpected reason.' >&2
  exit 1
fi

cat > apps/game/src/application/rci-building-reconciliation.ts <<'EOF'
import type { BuildingSnapshot } from '@web-three-city/building-core';
import {
  synchronizeDwellingInventory,
  synchronizeWorkplaceInventory,
  type RciDefinitionRegistries,
  type RciSnapshot,
} from '@web-three-city/rci-core';

export function reconcileRciForBuildingChange(
  input: Readonly<{
    rci: RciSnapshot;
    buildingsBefore: BuildingSnapshot;
    buildingsAfter: BuildingSnapshot;
    registries: RciDefinitionRegistries;
    evaluationTick: number;
  }>,
): RciSnapshot {
  const housing = synchronizeDwellingInventory(input).proposedSnapshot;
  return synchronizeWorkplaceInventory({ ...input, snapshot: housing }).proposedSnapshot;
}
EOF

python <<'PY'
from pathlib import Path

# Per-publication presentation adapter allows dirty updates while keeping publish-before-presentation semantics.
p = Path('apps/game/src/application/world-transaction-coordinator.ts')
text = p.read_text()
text = text.replace(
    "  readonly nextFingerprint: string;\n}",
    "  readonly nextFingerprint: string;\n  readonly presentation?: WorldPresentationPort;\n}",
    1,
)
text = text.replace(
    "    if (this.#presentation === null) {",
    "    const presentation = plan.presentation ?? this.#presentation;\n    if (presentation === null) {",
    1,
)
text = text.replace("      this.#presentation.synchronize(candidate);", "      presentation.synchronize(candidate);", 1)
text = text.replace("        this.#presentation.rebuildFromCommitted(candidate);", "        presentation.rebuildFromCommitted(candidate);", 1)
p.write_text(text)

# Undo records complete authority plus the user-visible domain for counters/evidence.
p = Path('apps/game/src/application/undo-coordinator.ts')
text = p.read_text()
text = text.replace(
    "export class UndoCoordinator {\n  readonly #transactionCoordinator: WorldTransactionCoordinator;\n  #beforeWorld: CommittedWorld | null = null;",
    "export type WorldUndoKind = 'terraform' | 'road' | 'zone' | 'building';\n\nexport class UndoCoordinator {\n  readonly #transactionCoordinator: WorldTransactionCoordinator;\n  #beforeWorld: CommittedWorld | null = null;\n  #kind: WorldUndoKind | null = null;",
)
text = text.replace(
    "  get available(): boolean {\n    return this.#beforeWorld !== null;\n  }\n\n  record(world: CommittedWorld): void {\n    this.#beforeWorld = createCommittedWorld(world);\n  }\n\n  clear(): void {\n    this.#beforeWorld = null;\n  }",
    "  get available(): boolean {\n    return this.#beforeWorld !== null;\n  }\n\n  get kind(): WorldUndoKind | null {\n    return this.#kind;\n  }\n\n  record(world: CommittedWorld, kind: WorldUndoKind = 'building'): void {\n    this.#beforeWorld = createCommittedWorld(world);\n    this.#kind = kind;\n  }\n\n  clear(): void {\n    this.#beforeWorld = null;\n    this.#kind = null;\n  }",
)
text = text.replace(
    "    if (result.status === 'committed') this.#beforeWorld = null;",
    "    if (result.status === 'committed') this.clear();",
)
p.write_text(text)

# Persistence load is synchronous; await remains compatible in tests.
p = Path('apps/game/src/application/save-coordinator.ts')
text = p.read_text().replace('  async load(): Promise<WorldPublicationResult> {', '  load(): WorldPublicationResult {')
p.write_text(text)

# Runtime composition migration.
p = Path('apps/game/src/game-bootstrap.ts')
text = p.read_text()
text = text.replace(
    "  createFoundationRciRegistries,\n  createInitialRciSnapshot,\n  type RciSnapshot,",
    "  createFoundationRciRegistries,\n  createInitialRciSnapshot,\n  type RciSnapshot,",
)
text = text.replace(
    "  createInitialSimulationSnapshot,\n  type SimulationSnapshot,",
    "  createInitialSimulationSnapshot,\n  createSimulationSnapshot,\n  type SimulationSnapshot,",
)
text = text.replace(
    "import { decodeWorldSave, encodeWorldSaveV5, type DecodedWorldState } from './world-save.js';\n",
    "",
)
text = text.replace("import { WorldUndoStore, type WorldUndoEntry } from './world-undo.js';\n", "")
application_imports = """import {
  CommittedWorldStore,
  createCommittedWorld,
  createCommittedWorldFromDomainState,
  type CommittedDomainState,
  type CommittedWorld,
} from './application/committed-world.js';
import { fingerprintCommittedWorld } from './application/committed-world-fingerprint.js';
import { reconcileRciForBuildingChange } from './application/rci-building-reconciliation.js';
import { SaveCoordinator } from './application/save-coordinator.js';
import { UndoCoordinator } from './application/undo-coordinator.js';
import {
  DefaultWorldTransactionCoordinator,
  type WorldPresentationPort,
  type WorldPublicationResult,
} from './application/world-transaction-coordinator.js';
"""
anchor = "import { createBuildingDevelopmentEnvironment } from './building-development-environment.js';\n"
if application_imports not in text:
    text = text.replace(anchor, application_imports + anchor, 1)
for constant in [
    "const WORLD_SAVE_KEY = 'web-three-city:world-save:v5';\n",
    "const LEGACY_WORLD_SAVE_V3_KEY = 'web-three-city:world-save:v3';\n",
    "const LEGACY_WORLD_SAVE_V2_KEY = 'web-three-city:world-save:v2';\n",
    "const LEGACY_WORLD_SAVE_KEY = 'web-three-city:world-save:v1';\n",
    "const LEGACY_TERRAIN_SAVE_KEY = 'web-three-city:terrain-save:v1';\n",
]:
    text = text.replace(constant, '')
text = text.replace(
    "export interface GameRuntime {\n  runBackgroundGrowthTick(simulation: SimulationSnapshot): SimulationSnapshot;\n  dispose(): void;\n}",
    "export interface GameRuntime {\n  runBackgroundGrowthTick(simulation: SimulationSnapshot): SimulationSnapshot;\n  runSimulationOnlyTick(simulation: SimulationSnapshot): SimulationSnapshot;\n  dispose(): void;\n}",
)
text = text.replace(
    "      runBackgroundGrowthTick(simulation: SimulationSnapshot): SimulationSnapshot {\n        return simulation;\n      },\n      dispose(): void {},",
    "      runBackgroundGrowthTick(simulation: SimulationSnapshot): SimulationSnapshot {\n        return simulation;\n      },\n      runSimulationOnlyTick(simulation: SimulationSnapshot): SimulationSnapshot {\n        return simulation;\n      },\n      dispose(): void {},",
)
# Remove legacy runtime aggregate declaration; ticks use a scratch projection.
start = text.find("  const worldStateStore = new GameWorldStateStore({\n")
if start < 0:
    raise SystemExit('legacy world state store declaration not found')
end = text.find("  let pendingLoadedSimulation", start)
text = text[:start] + text[end:]
# Remove old per-domain Undo store.
text = text.replace("  const undoStore = new WorldUndoStore(WORLD_CONFIG);\n", "")

# Replace legacy replacement functions with authority composition/presentation helpers.
start = text.find("  const replaceCompleteWorld = (\n")
end = text.find("  const applyTerraformPlan =", start)
if start < 0 or end < 0:
    raise SystemExit('legacy replacement block not found')
replacement = r'''  const initialCommittedWorld = createCommittedWorld({
    revision: 0,
    terrain: snapshot,
    water: waterSnapshot,
    roads: roadsSnapshot,
    zones: zonesSnapshot,
    buildings: buildingsSnapshot,
    simulation: simulationSnapshot,
    rci: rciSnapshot,
    environments: Object.freeze({
      road: roadEnvironment,
      zone: zoneEnvironment,
      building: buildingEnvironment,
    }),
  });
  const committedWorldStore = new CommittedWorldStore(initialCommittedWorld);

  const adoptCommittedWorld = (world: CommittedWorld): void => {
    snapshot = world.terrain;
    waterSnapshot = world.water;
    roadsSnapshot = world.roads;
    roadEnvironment = world.environments.road;
    zonesSnapshot = world.zones;
    zoneEnvironment = world.environments.zone;
    buildingsSnapshot = world.buildings;
    buildingEnvironment = world.environments.building;
    simulationSnapshot = world.simulation;
    rciSnapshot = world.rci;
    rciHud.update(rciSnapshot, rciRegistries, simulationSnapshot.absoluteTick);
    ui.setZoneCounts(zoneCounts(zonesSnapshot));
    ui.setBuildingCount(buildingCount(buildingsSnapshot));
  };

  const presentCompleteWorld = (world: CommittedWorld): void => {
    replacingWorld = true;
    try {
      terrain.load(world.terrain);
      const presentationStart = performance.now();
      water.load(world.terrain, world.water);
      waterPresentationDurationMs = performance.now() - presentationStart;
      waterBuildMetrics = stagedWaterBuildMetrics;
      grid.load(world.terrain);
      roadPresentation.loadAll(world.roads, world.environments.road);
      zoneSurfaceSnapshot = world.terrain;
      zonePresentation.loadAll(world.zones);
      buildingPresentation.load(world.buildings);
      rebuildSelection(selection, world.terrain, selectedCell);
      inputRef.current?.refreshTerrainObjects();
    } finally {
      replacingWorld = false;
    }
  };
  const completeWorldPresentation: WorldPresentationPort = Object.freeze({
    synchronize: presentCompleteWorld,
    rebuildFromCommitted: presentCompleteWorld,
  });
  const incrementalPresentation = (
    synchronize: (world: CommittedWorld) => void,
  ): WorldPresentationPort =>
    Object.freeze({ synchronize, rebuildFromCommitted: presentCompleteWorld });
  const noOpPresentation: WorldPresentationPort = Object.freeze({
    synchronize: () => {},
    rebuildFromCommitted: presentCompleteWorld,
  });
  const transactionCoordinator = new DefaultWorldTransactionCoordinator({
    worldStore: committedWorldStore,
    presentation: completeWorldPresentation,
  });
  const saveCoordinator = new SaveCoordinator({
    storage: Object.freeze({
      read: (key: string) => localStorage.getItem(key),
      write: (key: string, value: string) => localStorage.setItem(key, value),
    }),
    worldStore: committedWorldStore,
    transactionCoordinator,
  });
  const undoCoordinator = new UndoCoordinator({ transactionCoordinator });

  type DomainOverrides = Partial<Omit<CommittedDomainState, 'revision'>>;
  const publishCommittedDomain = (
    overrides: DomainOverrides,
    presentation?: WorldPresentationPort,
  ): Readonly<{ before: CommittedWorld; result: WorldPublicationResult }> => {
    const before = transactionCoordinator.snapshot();
    const nextWorld = createCommittedWorldFromDomainState({
      revision: before.revision + 1,
      terrain: overrides.terrain ?? before.terrain,
      roads: overrides.roads ?? before.roads,
      zones: overrides.zones ?? before.zones,
      buildings: overrides.buildings ?? before.buildings,
      simulation: overrides.simulation ?? before.simulation,
      rci: overrides.rci ?? before.rci,
    });
    const result = transactionCoordinator.publish({
      baseRevision: before.revision,
      baseFingerprint: fingerprintCommittedWorld(before),
      nextWorld,
      nextFingerprint: fingerprintCommittedWorld(nextWorld),
      ...(presentation === undefined ? {} : { presentation }),
    });
    if (result.status === 'committed') adoptCommittedWorld(result.world);
    return Object.freeze({ before, result });
  };

'''
text = text[:start] + replacement + text[end:]

# Replace interactive mutation functions as one bounded block.
start = text.find("  const applyTerraformPlan =")
end = text.find("  const applyBuildingBulldozeRequest", start)
if start < 0 or end < 0:
    raise SystemExit('interactive mutation block not found')
mutation_block = r'''  const applyTerraformPlan = (plan: TerraformPlan): void => {
    const current = transactionCoordinator.snapshot();
    const candidate = guardTerraformPlanWithOccupancy(
      plan,
      current.roads,
      current.zones,
      current.buildings,
    );
    if (!candidate.valid) {
      ui.setStatus(
        candidate.invalidReason === 'terraform:building-occupied'
          ? 'Terraform blocked by building'
          : candidate.invalidReason === 'terraform:zone-occupied'
            ? 'Terraform blocked by zone'
            : candidate.invalidReason === 'terraform:road-occupied'
              ? 'Terraform blocked by road'
              : 'Terraform rejected',
      );
      ui.setUndoAvailable(undoCoordinator.available);
      return;
    }

    try {
      const committed = commitTerraformPlan(current.terrain, plan, WORLD_CONFIG);
      const derivationStart = performance.now();
      const publication = publishCommittedDomain({ terrain: committed.snapshot });
      if (publication.result.status === 'committed') {
        undoCoordinator.record(publication.before, 'terraform');
        terraformCommitCount += 1;
        terraformWaterRebuildCount += 1;
        waterDerivationDurationMs = performance.now() - derivationStart;
        ui.setStatus('Terraform applied');
      } else {
        ui.setStatus('Terraform rejected');
      }
    } catch {
      ui.setStatus('Terraform rejected');
    }
    ui.setUndoAvailable(undoCoordinator.available);
  };

  const applyRoadPlan = (
    plan: RoadMutationPlan,
    routedReason: GameRoadBuildingInvalidReason | null = null,
  ): void => {
    const current = transactionCoordinator.snapshot();
    const zoneCandidate = guardRoadPlanWithZones(
      plan,
      current.roads,
      current.zones,
      current.terrain,
      current.water,
      createBuildingWorldOccupancy(current.buildings),
      WORLD_CONFIG,
    );
    const candidate = guardRoadPlanWithBuildings(
      zoneCandidate,
      current.roads,
      current.buildings,
      current.terrain,
      current.water,
      current.zones,
      WORLD_CONFIG,
    );
    const reason = routedReason ?? candidate.invalidReason;
    if (!candidate.valid) {
      ui.setStatus(statusForRoadPlan(candidate.previewPlan, reason));
      ui.setUndoAvailable(undoCoordinator.available);
      return;
    }

    try {
      const committed = commitRoadMutation(
        current.roads,
        candidate.corePlan,
        current.environments.road,
        WORLD_CONFIG,
      );
      const publication = publishCommittedDomain(
        { roads: committed.snapshot },
        incrementalPresentation((world) =>
          roadPresentation.rebuildDirty(
            world.roads,
            world.environments.road,
            committed.receipt.dirtyChunks,
          ),
        ),
      );
      if (publication.result.status === 'committed') {
        undoCoordinator.record(publication.before, 'road');
        roadLastDirtyChunkCount = committed.receipt.dirtyChunks.length;
        roadChunkRebuildCount += committed.receipt.dirtyChunks.length;
        if (committed.receipt.addedCellCount > 0) roadCommitCount += 1;
        if (committed.receipt.removedCellCount > 0) roadBulldozeCount += 1;
        ui.setStatus(statusForRoadPlan(candidate.corePlan));
      } else {
        ui.setStatus('Road update failed');
      }
    } catch {
      ui.setStatus('Road update failed');
    }
    ui.setUndoAvailable(undoCoordinator.available);
  };

  const applyZonePlan = (plan: ZoneMutationPlan): void => {
    const current = transactionCoordinator.snapshot();
    const revalidatedPlan = planZoneMutation(
      current.zones,
      { operation: plan.operation, definitionId: plan.definitionId, cells: plan.requestedCells },
      current.environments.zone,
      WORLD_CONFIG,
    );
    const candidate = guardZonePlanWithBuildings(revalidatedPlan, current.buildings);
    const reason = candidate.invalidReason;
    zoneInvalidReason = reason;
    if (!candidate.valid || reason !== null) {
      ui.setStatus(statusForZonePlan(candidate.previewPlan, reason));
      ui.setUndoAvailable(undoCoordinator.available);
      return;
    }

    try {
      const committed = commitZoneMutation(
        current.zones,
        candidate.corePlan,
        current.environments.zone,
        WORLD_CONFIG,
      );
      const publication = publishCommittedDomain(
        { zones: committed.snapshot },
        incrementalPresentation((world) =>
          zonePresentation.rebuildDirty(world.zones, committed.receipt.dirtyChunks),
        ),
      );
      if (publication.result.status === 'committed') {
        undoCoordinator.record(publication.before, 'zone');
        zoneLastDirtyChunkCount = committed.receipt.dirtyChunks.length;
        zoneChunkRebuildCount += committed.receipt.dirtyChunks.length;
        if (candidate.corePlan.operation === 'paint') zoneCommitCount += 1;
        else zoneRemoveCount += 1;
        zoneInvalidReason = null;
        ui.setStatus(statusForZonePlan(candidate.corePlan));
      } else {
        ui.setStatus('Zone update failed');
      }
    } catch {
      ui.setStatus('Zone update failed');
    }
    ui.setUndoAvailable(undoCoordinator.available);
  };

  const commitBuildingBulldozePlan = (plan: BuildingMutationPlan): void => {
    if (plan.operation !== 'bulldoze') {
      throw new Error('game:interactive-building-operation-must-be-bulldoze');
    }
    buildingInvalidReason = plan.invalidReason;
    if (!plan.valid) {
      ui.setStatus(statusForBuildingBulldozePlan(plan));
      ui.setUndoAvailable(undoCoordinator.available);
      return;
    }
    const current = transactionCoordinator.snapshot();
    dispatchGameTransactionState(ui.canvas, 'committing', 'building');
    try {
      const committed = commitBuildingMutation(
        current.buildings,
        plan,
        current.environments.building,
        WORLD_CONFIG,
      );
      const reconciledRci = reconcileRciForBuildingChange({
        rci: current.rci,
        buildingsBefore: current.buildings,
        buildingsAfter: committed.snapshot,
        registries: rciRegistries,
        evaluationTick: current.simulation.absoluteTick,
      });
      const publication = publishCommittedDomain(
        { buildings: committed.snapshot, rci: reconciledRci },
        incrementalPresentation((world) => buildingPresentation.load(world.buildings)),
      );
      if (publication.result.status === 'committed') {
        undoCoordinator.record(publication.before, 'building');
        buildingBulldozeCount += 1;
        buildingInvalidReason = null;
        ui.setStatus(statusForBuildingBulldozePlan(plan));
      } else {
        ui.setStatus('Building update failed');
      }
    } catch {
      ui.setStatus('Building update failed');
    }
    ui.setUndoAvailable(undoCoordinator.available);
  };

'''
text = text[:start] + mutation_block + text[end:]

# Replace tick function and add simulation-only publication.
start = text.find("  const runBackgroundGrowthTick =")
end = text.find("  const resetCamera", start)
if start < 0 or end < 0:
    raise SystemExit('tick block not found')
tick_block = r'''  const runBackgroundGrowthTick = (simulation: SimulationSnapshot): SimulationSnapshot => {
    const current = transactionCoordinator.snapshot();
    const baseSimulation = pendingLoadedSimulation ?? simulation;
    pendingLoadedSimulation = null;
    const tickStore = new GameWorldStateStore({
      revision: 0,
      simulation: baseSimulation,
      buildings: current.buildings,
      rci: current.rci,
    });
    try {
      const result = executeGameWorldTick({
        store: tickStore,
        environment: current.environments.building,
        config: WORLD_CONFIG,
        registries: rciRegistries,
        reservedCells: inputRef.current?.getBackgroundGrowthReservations() ?? Object.freeze([]),
      });
      const buildingsChanged = result.state.buildings.revision !== current.buildings.revision;
      const publication = publishCommittedDomain(
        {
          simulation: result.state.simulation,
          buildings: result.state.buildings,
          rci: result.state.rci,
        },
        buildingsChanged
          ? incrementalPresentation((world) => buildingPresentation.load(world.buildings))
          : noOpPresentation,
      );
      if (publication.result.status !== 'committed') return current.simulation;
      if (buildingsChanged) buildingCommitCount += 1;
      return publication.result.world.simulation;
    } catch {
      return current.simulation;
    }
  };

  const runSimulationOnlyTick = (simulation: SimulationSnapshot): SimulationSnapshot => {
    const next = createSimulationSnapshot({
      revision: simulation.revision + 1,
      absoluteTick: simulation.absoluteTick + 1,
      growthSequence: simulation.growthSequence,
    });
    const publication = publishCommittedDomain({ simulation: next }, noOpPresentation);
    return publication.result.status === 'committed'
      ? publication.result.world.simulation
      : transactionCoordinator.snapshot().simulation;
  };

'''
text = text[:start] + tick_block + text[end:]

# Replace direct Save and Load ownership.
save_start = text.find("  ui.saveButton.addEventListener(\n")
rotate_start = text.find("  ui.rotateLeftButton.addEventListener(\n", save_start)
if save_start < 0 or rotate_start < 0:
    raise SystemExit('save/load listener block not found')
save_load = r'''  ui.saveButton.addEventListener(
    'click',
    () => {
      input.clearActiveSession();
      saveCoordinator.save();
      ui.setStatus('Saved');
    },
    listenerOptions,
  );
  ui.loadButton.addEventListener(
    'click',
    () => {
      input.clearActiveSession();
      const result = saveCoordinator.load();
      if (result.status === 'rejected') {
        ui.setStatus(result.reason === 'world:no-save' ? 'No save' : 'Invalid save');
        return;
      }
      adoptCommittedWorld(result.world);
      pendingLoadedSimulation = result.world.simulation;
      undoCoordinator.clear();
      ui.setUndoAvailable(false);
      ui.setStatus('Loaded');
    },
    listenerOptions,
  );
'''
text = text[:save_start] + save_load + text[rotate_start:]

# Replace dependent-world Undo handler.
undo_start = text.find("  ui.undoButton.addEventListener(\n")
resize_start = text.find("  window.addEventListener('resize'", undo_start)
if undo_start < 0 or resize_start < 0:
    raise SystemExit('undo listener block not found')
undo_handler = r'''  ui.undoButton.addEventListener(
    'click',
    () => {
      input.clearActiveSession();
      const kind = undoCoordinator.kind;
      const before = transactionCoordinator.snapshot();
      const result = undoCoordinator.undo();
      if (result === null || result.status === 'rejected') {
        ui.setUndoAvailable(undoCoordinator.available);
        return;
      }
      adoptCommittedWorld(result.world);
      if (kind === 'terraform') {
        terraformUndoCount += 1;
        terraformWaterRebuildCount += 1;
        ui.setStatus('Terraform undone');
      } else if (kind === 'road') {
        const dirtyChunks = roadDirtyChunksBetween(before.roads, result.world.roads);
        roadUndoCount += 1;
        roadLastDirtyChunkCount = dirtyChunks.length;
        roadChunkRebuildCount += dirtyChunks.length;
        ui.setStatus('Road undone');
      } else if (kind === 'zone') {
        const dirtyChunks = zoneDirtyChunksBetween(before.zones, result.world.zones);
        zoneUndoCount += 1;
        zoneLastDirtyChunkCount = dirtyChunks.length;
        zoneChunkRebuildCount += dirtyChunks.length;
        zoneInvalidReason = null;
        ui.setStatus('Zone undone');
      } else if (kind === 'building') {
        buildingUndoCount += 1;
        buildingInvalidReason = null;
        ui.setStatus('Building undone');
      }
      ui.setUndoAvailable(undoCoordinator.available);
    },
    listenerOptions,
  );
'''
text = text[:undo_start] + undo_handler + text[resize_start:]

# Evidence now reads the dependent-world Undo authority.
text = text.replace('undoAvailable: undoStore.available', 'undoAvailable: undoCoordinator.available')
text = text.replace('undoKind: undoStore.kind', 'undoKind: undoCoordinator.kind')
# Runtime exposes both tick modes to main.ts.
text = text.replace('  return { runBackgroundGrowthTick, dispose };', '  return { runBackgroundGrowthTick, runSimulationOnlyTick, dispose };')
p.write_text(text)

# Main routes simulation-only foreground ticks through the runtime authority.
p = Path('apps/game/src/main.ts')
text = p.read_text()
text = text.replace('  createInitialSimulationSnapshot,\n  createSimulationSnapshot,', '  createInitialSimulationSnapshot,')
old = """  simulation = automaticGrowthEnabled
    ? runtime.runBackgroundGrowthTick(simulation)
    : createSimulationSnapshot({
        revision: simulation.revision + 1,
        absoluteTick: simulation.absoluteTick + 1,
        growthSequence: simulation.growthSequence,
      });
"""
new = """  simulation = automaticGrowthEnabled
    ? runtime.runBackgroundGrowthTick(simulation)
    : runtime.runSimulationOnlyTick(simulation);
"""
if old not in text:
    raise SystemExit('main tick branch changed unexpectedly')
p.write_text(text.replace(old, new, 1))

# Same-PR living handoff.
p = Path('docs/systems/architecture-infrastructure/README.md')
text = p.read_text()
if '## Implementation Slice 3' not in text:
    text += """

## Implementation Slice 3

Runtime mutation authority now routes through the committed-world transaction seam. Terraform, Road, Zone, Building bulldoze, simulation ticks, Save/Load, and dependent-world Undo all publish one complete candidate revision before presentation. Building mutations reconcile dwelling/workplace RCI inventory before publication, Save reads only `CommittedWorldStore`, load publishes decoded state through the same coordinator, and Undo restores the complete prior domain world while advancing only the application revision. Presentation failures after publication are recovery events and do not roll domain authority back.
"""
p.write_text(text)
PY

pnpm format
pnpm --filter @web-three-city/game test -- src/application/rci-building-reconciliation.test.ts src/game-bootstrap-authority.test.ts src/application/world-transaction-coordinator.test.ts src/application/save-coordinator.test.ts src/application/undo-coordinator.test.ts src/game-world-tick.test.ts src/world-save-v5.test.ts src/world-undo.test.ts src/world-undo-building.test.ts
pnpm --filter @web-three-city/game typecheck
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/rci-core typecheck

git rm .github/workflows/architecture-pr3c-author.yml tooling/architecture-pr3c-author.sh
git add apps/game/src/application/rci-building-reconciliation.ts apps/game/src/application/rci-building-reconciliation.test.ts apps/game/src/application/world-transaction-coordinator.ts apps/game/src/application/save-coordinator.ts apps/game/src/application/undo-coordinator.ts apps/game/src/game-bootstrap.ts apps/game/src/game-bootstrap-authority.test.ts apps/game/src/main.ts docs/systems/architecture-infrastructure/README.md
git commit -m 'refactor(game): route runtime mutations through committed world'
test -z "$(git status --porcelain=v1 --untracked-files=all)"
pnpm verify
git push origin HEAD:refactor/dependent-world-consistency-v0-1
