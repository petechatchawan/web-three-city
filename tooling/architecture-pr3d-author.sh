#!/usr/bin/env bash
set -euo pipefail

pnpm install --frozen-lockfile

cat > apps/game/src/game-runtime-authority.test.ts <<'EOF'
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');
const bootstrapSource = readFileSync(resolve(process.cwd(), 'src/game-bootstrap.ts'), 'utf8');

describe('GameRuntime committed-world authority', () => {
  it('keeps Save decoding, storage reads, and Building authority out of main.ts', () => {
    expect(mainSource).not.toMatch(/latestPresentedBuildingSnapshot|decodeWorldSave|localStorage|WORLD_SAVE_KEYS|CURRENT_WORLD_SAVE_KEY/);
    expect(mainSource).toMatch(/runtime\.snapshot\(\)/);
    expect(mainSource).toMatch(/runtime\.subscribeCommittedWorld/);
    expect(mainSource).toMatch(/runtime\.advanceLogicalTick/);
  });

  it('exposes one committed-world read and tick command surface', () => {
    expect(bootstrapSource).toMatch(/snapshot\(\): CommittedWorld/);
    expect(bootstrapSource).toMatch(/subscribeCommittedWorld/);
    expect(bootstrapSource).toMatch(/advanceLogicalTick/);
    expect(bootstrapSource).toMatch(/savePayload/);
  });
});
EOF

set +e
RED_OUTPUT="$(pnpm --filter @web-three-city/game test -- src/game-runtime-authority.test.ts 2>&1)"
RED_STATUS=$?
set -e
if [ "$RED_STATUS" -eq 0 ]; then
  echo 'Expected GameRuntime authority RED before implementation.' >&2
  exit 1
fi
if ! grep -Eq 'latestPresentedBuildingSnapshot|runtime\.snapshot|subscribeCommittedWorld|advanceLogicalTick' <<< "$RED_OUTPUT"; then
  printf '%s\n' "$RED_OUTPUT" >&2
  echo 'RED failed for an unexpected reason.' >&2
  exit 1
fi

python <<'PY'
from pathlib import Path
p = Path('apps/game/src/game-bootstrap.ts')
text = p.read_text()

old_interface = """export interface GameRuntime {
  runBackgroundGrowthTick(simulation: SimulationSnapshot): SimulationSnapshot;
  runSimulationOnlyTick(simulation: SimulationSnapshot): SimulationSnapshot;
  dispose(): void;
}
"""
new_interface = """export type CommittedWorldChangeReason = 'publication' | 'load' | 'undo' | 'reset';
export type CommittedWorldSubscriber = (
  world: CommittedWorld,
  reason: CommittedWorldChangeReason,
) => void;

export interface GameRuntime {
  snapshot(): CommittedWorld;
  subscribeCommittedWorld(subscriber: CommittedWorldSubscriber): () => void;
  advanceLogicalTick(input: Readonly<{ automaticGrowth: boolean }>): CommittedWorld;
  resetSimulationForTest(): CommittedWorld;
  savePayload(): ReturnType<SaveCoordinator['savePayload']>;
  runBackgroundGrowthTick(simulation?: SimulationSnapshot): SimulationSnapshot;
  runSimulationOnlyTick(simulation?: SimulationSnapshot): SimulationSnapshot;
  dispose(): void;
}
"""
if old_interface not in text:
    raise SystemExit('GameRuntime interface shape changed')
text = text.replace(old_interface, new_interface, 1)

old_start = """export function bootstrapGame(root: HTMLElement): GameRuntime {
  const ui = renderGameUi(root);
  const capability = detectWebGL2(ui.canvas);
  if (!capability.supported) {
    ui.setStatus('WebGL2 unavailable');
    return {
      runBackgroundGrowthTick(simulation: SimulationSnapshot): SimulationSnapshot {
        return simulation;
      },
      runSimulationOnlyTick(simulation: SimulationSnapshot): SimulationSnapshot {
        return simulation;
      },
      dispose(): void {},
    };
  }

  const generated = generateCoastalTerrain({ seed: CURATED_SEED, config: WORLD_CONFIG });
  if (!generated.ok) throw new Error(`game:generation-failed:${generated.error.code}`);
  const initialWaterDerivationStart = performance.now();
  let snapshot = generated.value;
  let waterSnapshot = requireWater(snapshot);
  let roadsSnapshot = createEmptyRoadSnapshot(WORLD_CONFIG);
  let zonesSnapshot = createEmptyZoneSnapshot(WORLD_CONFIG);
  let buildingsSnapshot = createEmptyBuildingSnapshot(WORLD_CONFIG);
  const rciRegistries = createFoundationRciRegistries();
  let simulationSnapshot = createInitialSimulationSnapshot();
  let rciSnapshot: RciSnapshot = createInitialRciSnapshot({
    absoluteTick: simulationSnapshot.absoluteTick,
  });
  let pendingLoadedSimulation: SimulationSnapshot | null = null;
  let roadEnvironment = createRoadPlacementEnvironment(snapshot, waterSnapshot, WORLD_CONFIG);
  let zoneEnvironment = createZonePlacementEnvironment(
    snapshot,
    waterSnapshot,
    roadsSnapshot,
    createBuildingWorldOccupancy(buildingsSnapshot),
    WORLD_CONFIG,
  );
  let buildingEnvironment = createBuildingDevelopmentEnvironment(
    snapshot,
    waterSnapshot,
    roadsSnapshot,
    zonesSnapshot,
    WORLD_CONFIG,
  );
  let waterDerivationDurationMs = performance.now() - initialWaterDerivationStart;
"""
new_start = """export function bootstrapGame(root: HTMLElement): GameRuntime {
  const ui = renderGameUi(root);
  const generated = generateCoastalTerrain({ seed: CURATED_SEED, config: WORLD_CONFIG });
  if (!generated.ok) throw new Error(`game:generation-failed:${generated.error.code}`);
  const initialWaterDerivationStart = performance.now();
  const initialSimulation = createInitialSimulationSnapshot();
  const initialWorld = createCommittedWorldFromDomainState({
    revision: 0,
    terrain: generated.value,
    roads: createEmptyRoadSnapshot(WORLD_CONFIG),
    zones: createEmptyZoneSnapshot(WORLD_CONFIG),
    buildings: createEmptyBuildingSnapshot(WORLD_CONFIG),
    simulation: initialSimulation,
    rci: createInitialRciSnapshot({ absoluteTick: initialSimulation.absoluteTick }),
  });
  const capability = detectWebGL2(ui.canvas);
  if (!capability.supported) {
    ui.setStatus('WebGL2 unavailable');
    const unavailableWorld = new CommittedWorldStore(initialWorld);
    const subscribers = new Set<CommittedWorldSubscriber>();
    return {
      snapshot: () => unavailableWorld.snapshot(),
      subscribeCommittedWorld(subscriber: CommittedWorldSubscriber): () => void {
        subscribers.add(subscriber);
        return () => subscribers.delete(subscriber);
      },
      advanceLogicalTick: () => unavailableWorld.snapshot(),
      resetSimulationForTest: () => unavailableWorld.snapshot(),
      savePayload(): never {
        throw new Error('game:runtime-unavailable');
      },
      runBackgroundGrowthTick: () => unavailableWorld.snapshot().simulation,
      runSimulationOnlyTick: () => unavailableWorld.snapshot().simulation,
      dispose(): void {
        subscribers.clear();
      },
    };
  }

  let snapshot = initialWorld.terrain;
  let waterSnapshot = initialWorld.water;
  let roadsSnapshot = initialWorld.roads;
  let zonesSnapshot = initialWorld.zones;
  let buildingsSnapshot = initialWorld.buildings;
  const rciRegistries = createFoundationRciRegistries();
  let simulationSnapshot = initialWorld.simulation;
  let rciSnapshot: RciSnapshot = initialWorld.rci;
  let roadEnvironment = initialWorld.environments.road;
  let zoneEnvironment = initialWorld.environments.zone;
  let buildingEnvironment = initialWorld.environments.building;
  let waterDerivationDurationMs = performance.now() - initialWaterDerivationStart;
"""
if old_start not in text:
    raise SystemExit('bootstrap initialization shape changed')
text = text.replace(old_start, new_start, 1)

old_initial = """  const initialCommittedWorld = createCommittedWorld({
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
"""
new_initial = """  const committedWorldStore = new CommittedWorldStore(initialWorld);
  const committedWorldSubscribers = new Set<CommittedWorldSubscriber>();

  const notifyCommittedWorld = (
    world: CommittedWorld,
    reason: CommittedWorldChangeReason,
  ): void => {
    for (const subscriber of [...committedWorldSubscribers]) {
      try {
        subscriber(world, reason);
      } catch {
        // Subscriber failures are post-publication presentation failures and never roll authority back.
      }
    }
  };

  const adoptCommittedWorld = (
    world: CommittedWorld,
    reason: CommittedWorldChangeReason = 'publication',
  ): void => {
"""
if old_initial not in text:
    raise SystemExit('initial committed-world shape changed')
text = text.replace(old_initial, new_initial, 1)

old_adopt_tail = """    ui.setZoneCounts(zoneCounts(zonesSnapshot));
    ui.setBuildingCount(buildingCount(buildingsSnapshot));
  };
"""
new_adopt_tail = """    ui.setZoneCounts(zoneCounts(zonesSnapshot));
    ui.setBuildingCount(buildingCount(buildingsSnapshot));
    notifyCommittedWorld(world, reason);
  };
"""
if old_adopt_tail not in text:
    raise SystemExit('adopt tail changed')
text = text.replace(old_adopt_tail, new_adopt_tail, 1)

old_growth = """  const runBackgroundGrowthTick = (simulation: SimulationSnapshot): SimulationSnapshot => {
    const current = transactionCoordinator.snapshot();
    const baseSimulation = pendingLoadedSimulation ?? simulation;
    pendingLoadedSimulation = null;
    const tickStore = new GameWorldStateStore({
      revision: 0,
      simulation: baseSimulation,
"""
new_growth = """  const runBackgroundGrowthTick = (_simulation?: SimulationSnapshot): SimulationSnapshot => {
    const current = transactionCoordinator.snapshot();
    const tickStore = new GameWorldStateStore({
      revision: 0,
      simulation: current.simulation,
"""
if old_growth not in text:
    raise SystemExit('growth tick shape changed')
text = text.replace(old_growth, new_growth, 1)

old_sim = """  const runSimulationOnlyTick = (simulation: SimulationSnapshot): SimulationSnapshot => {
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
"""
new_sim = """  const runSimulationOnlyTick = (_simulation?: SimulationSnapshot): SimulationSnapshot => {
    const current = transactionCoordinator.snapshot();
    const next = createSimulationSnapshot({
      revision: current.simulation.revision + 1,
      absoluteTick: current.simulation.absoluteTick + 1,
      growthSequence: current.simulation.growthSequence,
    });
    const publication = publishCommittedDomain({ simulation: next }, noOpPresentation);
    return publication.result.status === 'committed'
      ? publication.result.world.simulation
      : transactionCoordinator.snapshot().simulation;
  };

  const advanceLogicalTick = (input: Readonly<{ automaticGrowth: boolean }>): CommittedWorld => {
    if (input.automaticGrowth) runBackgroundGrowthTick();
    else runSimulationOnlyTick();
    return transactionCoordinator.snapshot();
  };

  const resetSimulationForTest = (): CommittedWorld => {
    const publication = publishCommittedDomain(
      { simulation: createInitialSimulationSnapshot() },
      noOpPresentation,
    );
    if (publication.result.status === 'committed') {
      undoCoordinator.clear();
      notifyCommittedWorld(publication.result.world, 'reset');
      return publication.result.world;
    }
    return transactionCoordinator.snapshot();
  };

  const subscribeCommittedWorld = (subscriber: CommittedWorldSubscriber): (() => void) => {
    committedWorldSubscribers.add(subscriber);
    return () => committedWorldSubscribers.delete(subscriber);
  };
"""
if old_sim not in text:
    raise SystemExit('simulation-only tick shape changed')
text = text.replace(old_sim, new_sim, 1)

text = text.replace("      adoptCommittedWorld(result.world);\n      pendingLoadedSimulation = result.world.simulation;", "      adoptCommittedWorld(result.world, 'load');", 1)
text = text.replace("      adoptCommittedWorld(result.world);\n      if (kind === 'terraform')", "      adoptCommittedWorld(result.world, 'undo');\n      if (kind === 'terraform')", 1)

old_dispose = """    renderer.dispose();
    delete window.__WEB_THREE_CITY_INTERACTION__;
  };
  window.addEventListener('pagehide', dispose, { once: true });
  return { runBackgroundGrowthTick, runSimulationOnlyTick, dispose };
}
"""
new_dispose = """    renderer.dispose();
    committedWorldSubscribers.clear();
    delete window.__WEB_THREE_CITY_INTERACTION__;
  };
  window.addEventListener('pagehide', dispose, { once: true });
  return {
    snapshot: () => transactionCoordinator.snapshot(),
    subscribeCommittedWorld,
    advanceLogicalTick,
    resetSimulationForTest,
    savePayload: () => saveCoordinator.savePayload(),
    runBackgroundGrowthTick,
    runSimulationOnlyTick,
    dispose,
  };
}
"""
if old_dispose not in text:
    raise SystemExit('runtime return shape changed')
text = text.replace(old_dispose, new_dispose, 1)

# createCommittedWorld is no longer required after initial world construction moved to the canonical domain-state helper.
text = text.replace('  createCommittedWorld,\n', '', 1)
p.write_text(text)
PY

cat > apps/game/src/main.ts <<'EOF'
import './style.css';
import './growth-time.css';
import { constructionProgressAtTick } from '@web-three-city/building-core';
import {
  constructionVisualPhase,
  reloadLatestBuildingPresentation,
  setBuildingPresentationAbsoluteTick,
} from '@web-three-city/building-three';
import type { SimulationSpeed } from '@web-three-city/simulation-core';
import type { TerraformBrushSize } from '@web-three-city/terrain-core';
import { bootstrapGame } from './game-bootstrap.js';
import { bindGameKeyboardShortcuts } from './game-keyboard-shortcuts.js';
import { createGameTimePresentation } from './game-time-presentation.js';
import { mountGameTimeUi } from './game-time-ui.js';
import { createSimulationRuntime } from './simulation-runtime.js';
import { dispatchGameToolCancel, dispatchGameTransactionState } from './game-tool-events.js';
import { bindGameToolHud } from './game-tool-hud-binding.js';
import type { GameToolMode } from './game-tool-mode.js';
import { expandGameSecondaryControls } from './game-secondary-controls.js';
import { undoTransaction } from './game-transaction-presentation.js';

interface GameTimeTestApi {
  readonly snapshot: () => Readonly<{
    readonly revision: number;
    readonly simulation: ReturnType<ReturnType<typeof bootstrapGame>['snapshot']>['simulation'];
    readonly speed: SimulationSpeed;
    readonly buildingCount: number;
  }>;
  readonly savePayload: () => unknown;
  readonly setSpeed: (speed: SimulationSpeed) => void;
  readonly step: () => boolean;
  readonly setAutomaticGrowthEnabled: (enabled: boolean) => void;
  readonly resetForTest: () => void;
}

type GameTimeWindow = Window & {
  __WEB_THREE_CITY_TIME__?: GameTimeTestApi;
};

const rootElement = document.querySelector<HTMLElement>('#app');
if (rootElement === null) throw new Error('game:missing-root');
const root: HTMLElement = rootElement;
const runtime = bootstrapGame(root);

function requireButton(action: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
  if (button === null) throw new Error(`game:missing-action:${action}`);
  return button;
}

const canvasElement = root.querySelector<HTMLCanvasElement>('#game-canvas');
if (canvasElement === null) throw new Error('game:missing-canvas');
const canvas: HTMLCanvasElement = canvasElement;
const toolActions: Readonly<Record<GameToolMode, string>> = Object.freeze({
  navigate: 'tool-navigate',
  raise: 'tool-raise',
  lower: 'tool-lower',
  flatten: 'tool-flatten',
  'road-build': 'tool-road-build',
  'road-bulldoze': 'tool-road-bulldoze',
  'zone-residential': 'tool-zone-residential',
  'zone-commercial': 'tool-zone-commercial',
  'zone-industrial': 'tool-zone-industrial',
  'zone-remove': 'tool-zone-remove',
  'building-bulldoze': 'tool-building-bulldoze',
});
const brushActions = Object.freeze({ 1: 'brush-1', 3: 'brush-3', 5: 'brush-5' });
const navigateButton = requireButton('tool-navigate');
const closeToolButton = requireButton('tool-close');
const undoButton = requireButton('undo');
const bindings = new AbortController();
const automatedBrowser = navigator.webdriver === true;
let automaticGrowthEnabled = !automatedBrowser;

function currentBrush(): TerraformBrushSize {
  for (const size of [1, 3, 5] as const) {
    if (requireButton(brushActions[size]).getAttribute('aria-pressed') === 'true') return size;
  }
  return 1;
}

function cancelPreviewOrCloseTool(): void {
  const evidence = window.__WEB_THREE_CITY_INTERACTION__;
  if (
    evidence?.terraform.strokeActive === true ||
    evidence?.road.strokeActive === true ||
    evidence?.zone.strokeActive === true ||
    evidence?.building.strokeActive === true
  ) {
    dispatchGameToolCancel(canvas);
  } else {
    navigateButton.click();
  }
}

function dispatchUndoTransaction(): void {
  const transaction = undoTransaction(window.__WEB_THREE_CITY_INTERACTION__);
  if (transaction === null) return;
  dispatchGameTransactionState(canvas, transaction.state, transaction.domain);
}

const simulationRuntime = createSimulationRuntime('normal');
let previousFrameTimestamp: number | null = null;
let frameRequest = 0;
const phaseByInstance = new Map<string, string>();

function refreshTimeUi(world = runtime.snapshot()): void {
  timeUi.update(
    simulationRuntime.getState().speed,
    createGameTimePresentation(world.simulation, world.buildings),
  );
}

function refreshConstructionPhaseIfNeeded(world = runtime.snapshot()): void {
  let changed = false;
  const next = new Map<string, string>();
  for (const instance of world.buildings.instances) {
    const phase =
      instance.lifecycle === 'construction'
        ? constructionVisualPhase(constructionProgressAtTick(instance, world.simulation.absoluteTick))
        : 'active';
    next.set(instance.instanceId, phase);
    if (phaseByInstance.get(instance.instanceId) !== phase) changed = true;
  }
  if (phaseByInstance.size !== next.size) changed = true;
  phaseByInstance.clear();
  for (const [instanceId, phase] of next) phaseByInstance.set(instanceId, phase);
  if (changed) reloadLatestBuildingPresentation();
}

function synchronizeCommittedWorld(
  world: ReturnType<typeof runtime.snapshot>,
  reason: Parameters<Parameters<typeof runtime.subscribeCommittedWorld>[0]>[1],
): void {
  if (reason === 'load') {
    simulationRuntime.setSpeed('paused');
    simulationRuntime.resetAfterVisibilityChange();
  }
  setBuildingPresentationAbsoluteTick(world.simulation.absoluteTick);
  refreshConstructionPhaseIfNeeded(world);
  refreshTimeUi(world);
}

function advanceOneLogicalTick(): void {
  runtime.advanceLogicalTick({ automaticGrowth: automaticGrowthEnabled });
}

function setSimulationSpeed(speed: SimulationSpeed): void {
  simulationRuntime.setSpeed(speed);
  refreshTimeUi();
}

function resetSimulationForTest(): void {
  simulationRuntime.setSpeed('paused');
  simulationRuntime.resetAfterVisibilityChange();
  phaseByInstance.clear();
  const world = runtime.resetSimulationForTest();
  setBuildingPresentationAbsoluteTick(world.simulation.absoluteTick);
  refreshConstructionPhaseIfNeeded(world);
  refreshTimeUi(world);
}

const timeUi = mountGameTimeUi(root, setSimulationSpeed, () => {
  simulationRuntime.step(advanceOneLogicalTick);
  refreshTimeUi();
});
const unsubscribeCommittedWorld = runtime.subscribeCommittedWorld(synchronizeCommittedWorld);
const initialWorld = runtime.snapshot();
setBuildingPresentationAbsoluteTick(initialWorld.simulation.absoluteTick);
refreshConstructionPhaseIfNeeded(initialWorld);
refreshTimeUi(initialWorld);

const timeWindow = window as GameTimeWindow;
timeWindow.__WEB_THREE_CITY_TIME__ = Object.freeze({
  snapshot: () => {
    const world = runtime.snapshot();
    return Object.freeze({
      revision: world.revision,
      simulation: world.simulation,
      speed: simulationRuntime.getState().speed,
      buildingCount: world.buildings.instances.length,
    });
  },
  savePayload: () => runtime.savePayload(),
  setSpeed: setSimulationSpeed,
  step: () => simulationRuntime.step(advanceOneLogicalTick),
  setAutomaticGrowthEnabled(enabled: boolean): void {
    automaticGrowthEnabled = enabled;
  },
  resetForTest: resetSimulationForTest,
});

function simulationFrame(timestamp: number): void {
  if (previousFrameTimestamp === null) previousFrameTimestamp = timestamp;
  const delta = timestamp - previousFrameTimestamp;
  previousFrameTimestamp = timestamp;
  if (document.visibilityState !== 'hidden') {
    simulationRuntime.advance(delta, advanceOneLogicalTick);
  }
  frameRequest = requestAnimationFrame(simulationFrame);
}
frameRequest = requestAnimationFrame(simulationFrame);

expandGameSecondaryControls(root);
window.dispatchEvent(new Event('resize'));
bindGameToolHud(root, canvas, bindings.signal);
closeToolButton.addEventListener('click', () => navigateButton.click(), {
  signal: bindings.signal,
});
undoButton.addEventListener('click', dispatchUndoTransaction, {
  capture: true,
  signal: bindings.signal,
});

bindGameKeyboardShortcuts(
  window,
  {
    selectTool: (mode) => requireButton(toolActions[mode]).click(),
    getBrush: currentBrush,
    selectBrush: (size) => requireButton(brushActions[size]).click(),
    requestUndo: () => undoButton.click(),
    cancelPreviewOrCloseTool,
  },
  bindings.signal,
);

document.addEventListener(
  'visibilitychange',
  () => {
    simulationRuntime.resetAfterVisibilityChange();
    previousFrameTimestamp = null;
    if (document.visibilityState === 'hidden') dispatchGameToolCancel(canvas);
  },
  { signal: bindings.signal },
);

window.addEventListener(
  'pagehide',
  () => {
    cancelAnimationFrame(frameRequest);
    unsubscribeCommittedWorld();
    timeUi.dispose();
    bindings.abort();
    runtime.dispose();
    delete timeWindow.__WEB_THREE_CITY_TIME__;
  },
  { once: true },
);
EOF

pnpm exec prettier --write apps/game/src/game-bootstrap.ts apps/game/src/main.ts apps/game/src/game-runtime-authority.test.ts
pnpm --filter @web-three-city/game test -- src/game-runtime-authority.test.ts
pnpm --filter @web-three-city/game typecheck

git rm -f .github/workflows/architecture-pr3d-author.yml tooling/architecture-pr3d-author.sh
git add apps/game/src/game-bootstrap.ts apps/game/src/main.ts apps/game/src/game-runtime-authority.test.ts
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git commit --no-verify -m 'refactor(game): centralize committed runtime reads'
git push origin HEAD:refactor/dependent-world-consistency-v0-1
