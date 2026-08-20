import './style.css';
import './ui/foundation/tokens.css';
import './ui/city-ui.css';
import './ui/m6-3-figma.css';
import './ui/m6-3-fidelity-remediation.css';
import './ui/m6-4-mobile-declutter.css';
import { constructionProgressAtTick } from '@web-three-city/building-core';
import {
  constructionVisualPhase,
  latestBuildingPresentationScene,
  reloadLatestBuildingPresentation,
  setBuildingPresentationAbsoluteTick,
} from '@web-three-city/building-three';
import { createFoundationRciRegistries } from '@web-three-city/rci-core';
import type { SimulationSpeed } from '@web-three-city/simulation-core';
import type { TerraformBrushSize } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { writeBrowserWorldSaveFixture } from './browser-world-save-fixture.js';
import { bootstrapGame } from './game-bootstrap.js';
import { renderGameCanvas } from './game-ui.js';
import { bindGameKeyboardShortcuts } from './game-keyboard-shortcuts.js';
import { createSimulationRuntime, type SimulationRuntimeEvent } from './simulation-runtime.js';
import { dispatchGameToolCancel } from './game-tool-events.js';
import { bindGameToolContext } from './game-tool-context-bridge.js';
import type { GameToolMode } from './game-tool-mode.js';
import { createTrafficPerformanceReleaseFixture } from './traffic-performance-release-fixture.js';
import {
  createTrafficReleaseFixture,
  type TrafficReleaseFixtureSummary,
} from './traffic-release-fixture.js';
import { createTrafficRecoveryReleaseFixture } from './traffic-recovery-release-fixture.js';
import { TrafficRuntimePresentation } from './traffic-runtime-presentation.js';
import { mountCityUi } from './ui/city-ui-runtime.js';

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
  readonly stepMinutes: (count: number) => boolean;
  readonly setAutomaticGrowthEnabled: (enabled: boolean) => void;
  readonly resetForTest: () => void;
}

interface TrafficRecoveryFixtureSummary {
  readonly citizenId: string;
  readonly tripId: string;
  readonly routeEdgeIds: readonly string[];
  readonly primaryRoadCutCell: Readonly<{ x: number; z: number }>;
}

interface TrafficPerformanceFixtureSummary {
  readonly citizenCount: number;
  readonly activeTripCount: number;
  readonly focusCell: Readonly<{ x: number; z: number }>;
}

interface TrafficTestApi {
  readonly snapshot: () => Readonly<{
    readonly worldRevision: number;
    readonly absoluteGameMinute: number;
    readonly citizenIds: readonly string[];
    readonly mobility: ReturnType<ReturnType<typeof bootstrapGame>['snapshot']>['mobility'];
    readonly traffic: ReturnType<ReturnType<typeof bootstrapGame>['snapshot']>['traffic'];
    readonly presentation: ReturnType<TrafficRuntimePresentation['debugSnapshot']> | null;
  }>;
  readonly installReleaseFixture: () => TrafficReleaseFixtureSummary;
  readonly installRoadRecoveryFixture: () => TrafficRecoveryFixtureSummary;
  readonly installPerformanceFixture: () => TrafficPerformanceFixtureSummary;
  readonly saveWorld: () => void;
  readonly loadWorld: () => void;
  readonly setTrafficView: (active: boolean) => void;
  readonly focusCell: (x: number, z: number) => void;
}

type GameTimeWindow = Window & {
  __WEB_THREE_CITY_TIME__?: GameTimeTestApi;
  __WEB_THREE_CITY_TRAFFIC__?: TrafficTestApi;
};

const rootElement = document.querySelector<HTMLElement>('#app');
if (rootElement === null) throw new Error('game:missing-root');
const root: HTMLElement = rootElement;
const host = renderGameCanvas(root);
const runtime = bootstrapGame(host);
const rciRegistries = createFoundationRciRegistries();
const trafficScene = latestBuildingPresentationScene();
const trafficRuntime = trafficScene === null ? null : new TrafficRuntimePresentation(trafficScene);

const bindings = new AbortController();
const automatedBrowser = navigator.webdriver === true;
let automaticGrowthEnabled = !automatedBrowser;
let currentBrushSize: TerraformBrushSize = 1;

function cancelPreviewOrCloseTool(): void {
  const evidence = window.__WEB_THREE_CITY_INTERACTION__;
  if (
    evidence?.terraform.strokeActive === true ||
    evidence?.road.strokeActive === true ||
    evidence?.zone.strokeActive === true ||
    evidence?.building.strokeActive === true
  ) {
    dispatchGameToolCancel(host.canvas);
    return;
  }

  const buildPicker = root.querySelector<HTMLElement>('[data-testid="build-picker"]');
  if (buildPicker !== null && !buildPicker.hidden) {
    root.querySelector<HTMLButtonElement>('[data-testid="nav-build"]')?.click();
    return;
  }

  cityUi.selectTool('navigate');
}

const simulationRuntime = createSimulationRuntime('paused');
let previousFrameTimestamp: number | null = null;
let frameRequest = 0;
let suppressPresentationSync = false;
const phaseByInstance = new Map<string, string>();

function refreshConstructionPhaseIfNeeded(world = runtime.snapshot()): void {
  let changed = false;
  const next = new Map<string, string>();
  for (const instance of world.buildings.instances) {
    const phase =
      instance.lifecycle === 'construction'
        ? constructionVisualPhase(
            constructionProgressAtTick(instance, world.simulation.absoluteGameMinute),
          )
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
  if (suppressPresentationSync) return;
  if (reason === 'load') {
    setSimulationSpeed('paused');
    simulationRuntime.resetAfterVisibilityChange();
  }
  setBuildingPresentationAbsoluteTick(world.simulation.absoluteGameMinute);
  refreshConstructionPhaseIfNeeded(world);
  trafficRuntime?.synchronize(world);
  cityUi.update(world);
}

function advanceRuntimeEvent(event: SimulationRuntimeEvent): void {
  if (event.type === 'game-minute') {
    runtime.advanceGameMinute({ automaticGrowth: automaticGrowthEnabled });
  } else {
    runtime.advanceTransportQuantum();
  }
}

function setSimulationSpeed(speed: SimulationSpeed): void {
  simulationRuntime.setSpeed(speed);
  cityUi.setSimulationSpeed(speed);
}

function resetSimulationForTest(): void {
  setSimulationSpeed('paused');
  simulationRuntime.resetAfterVisibilityChange();
  phaseByInstance.clear();
  const world = runtime.resetSimulationForTest();
  setBuildingPresentationAbsoluteTick(world.simulation.absoluteGameMinute);
  refreshConstructionPhaseIfNeeded(world);
  trafficRuntime?.synchronize(world);
}

function stepMinutesForTest(count: number): boolean {
  if (!Number.isSafeInteger(count) || count < 0) return false;
  if (simulationRuntime.getState().speed !== 'paused') return false;
  suppressPresentationSync = true;
  runtime.setPresentationSuppressed(true);
  try {
    for (let index = 0; index < count; index += 1) {
      if (!simulationRuntime.step(advanceRuntimeEvent)) return false;
    }
  } finally {
    runtime.setPresentationSuppressed(false);
    runtime.rebuildPresentationForTest();
    suppressPresentationSync = false;
  }
  synchronizeCommittedWorld(runtime.snapshot(), 'publication');
  return true;
}

function setInformationView(key: 'grid' | 'zoning' | 'traffic' | null): void {
  if (key === 'traffic') {
    runtime.setInformationView(null);
    trafficRuntime?.setTrafficInformationView(true);
    return;
  }
  trafficRuntime?.setTrafficInformationView(false);
  runtime.setInformationView(key);
}

function installWorldSaveFixture(payload: unknown): void {
  writeBrowserWorldSaveFixture(payload);
  automaticGrowthEnabled = true;
  setSimulationSpeed('paused');
  runtime.loadWorld();
}

const cityUi = mountCityUi(root, {
  setSpeed: setSimulationSpeed,
  selectTool: (mode) => runtime.selectTool(mode),
  setTerraformBrush: (size) => {
    currentBrushSize = size;
    runtime.setTerraformBrush(size);
  },
  submitTaxPolicy: (policy) => runtime.submitTaxPolicy(policy),
  setInformationView,
  saveWorld: () => runtime.saveWorld(),
  loadWorld: () => runtime.loadWorld(),
  rotateLeft: () => runtime.rotateLeft(),
  rotateRight: () => runtime.rotateRight(),
  resetCamera: () => runtime.resetCamera(),
  toggleGrid: () => runtime.toggleGrid(),
  setQuality: (quality) => runtime.setQuality(quality),
  step: () => {
    simulationRuntime.step(advanceRuntimeEvent);
  },
  undo: () => runtime.undo(),
  rciRegistries,
});

// Bootstrap completion/status feeds land on the compact M6.4 context surface.
host.onStatus((value) => cityUi.toolContextSheet.setStatus(value));
host.onUndoAvailable((available) => cityUi.toolContextSheet.setUndoAvailable(available));

const unsubscribeCommittedWorld = runtime.subscribeCommittedWorld(synchronizeCommittedWorld);
const unsubscribeWorldSelection = runtime.subscribeWorldSelection((cell) => {
  trafficRuntime?.setCameraAnchorFromCell(cell);
  const trafficTarget = trafficRuntime?.inspectTargetAtCell(cell) ?? null;
  if (trafficTarget === null) cityUi.inspectCell(cell);
  else cityUi.inspectTarget(trafficTarget);
});
const initialWorld = runtime.snapshot();
trafficRuntime?.synchronize(initialWorld);
cityUi.update(initialWorld);
setBuildingPresentationAbsoluteTick(initialWorld.simulation.absoluteGameMinute);
refreshConstructionPhaseIfNeeded(initialWorld);

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
  step: () => simulationRuntime.step(advanceRuntimeEvent),
  stepMinutes: stepMinutesForTest,
  setAutomaticGrowthEnabled(enabled: boolean): void {
    automaticGrowthEnabled = enabled;
  },
  resetForTest: resetSimulationForTest,
});
timeWindow.__WEB_THREE_CITY_TRAFFIC__ = Object.freeze({
  snapshot: () => {
    const world = runtime.snapshot();
    return Object.freeze({
      worldRevision: world.revision,
      absoluteGameMinute: world.simulation.absoluteGameMinute,
      citizenIds: Object.freeze(world.rci.population.citizens.map((citizen) => citizen.citizenId)),
      mobility: world.mobility,
      traffic: world.traffic,
      presentation: trafficRuntime?.debugSnapshot() ?? null,
    });
  },
  installReleaseFixture(): TrafficReleaseFixtureSummary {
    const fixture = createTrafficReleaseFixture();
    installWorldSaveFixture(fixture.save);
    trafficRuntime?.setCameraAnchorFromCell({ x: 64, z: 64 });
    return fixture.summary;
  },
  installRoadRecoveryFixture(): TrafficRecoveryFixtureSummary {
    const fixture = createTrafficRecoveryReleaseFixture();
    installWorldSaveFixture(fixture.save);
    trafficRuntime?.setCameraAnchorFromCell(fixture.primaryRoadCutCell);
    return Object.freeze({
      citizenId: fixture.citizenId,
      tripId: fixture.tripId,
      routeEdgeIds: fixture.routeEdgeIds,
      primaryRoadCutCell: fixture.primaryRoadCutCell,
    });
  },
  installPerformanceFixture(): TrafficPerformanceFixtureSummary {
    const fixture = createTrafficPerformanceReleaseFixture();
    installWorldSaveFixture(fixture.save);
    trafficRuntime?.setCameraAnchorFromCell(fixture.focusCell);
    return Object.freeze({
      citizenCount: fixture.citizenCount,
      activeTripCount: fixture.activeTripCount,
      focusCell: fixture.focusCell,
    });
  },
  saveWorld(): void {
    runtime.saveWorld();
  },
  loadWorld(): void {
    runtime.loadWorld();
  },
  setTrafficView(active: boolean): void {
    trafficRuntime?.setTrafficInformationView(active);
  },
  focusCell(x: number, z: number): void {
    if (!Number.isInteger(x) || !Number.isInteger(z)) return;
    if (x < 0 || z < 0 || x >= WORLD_CONFIG.mapWidth || z >= WORLD_CONFIG.mapHeight) return;
    trafficRuntime?.setCameraAnchorFromCell({ x, z });
  },
});

function simulationFrame(timestamp: number): void {
  if (previousFrameTimestamp === null) previousFrameTimestamp = timestamp;
  const delta = timestamp - previousFrameTimestamp;
  previousFrameTimestamp = timestamp;
  if (document.visibilityState !== 'hidden') {
    simulationRuntime.advance(delta, advanceRuntimeEvent);
    trafficRuntime?.frame(timestamp);
  }
  frameRequest = requestAnimationFrame(simulationFrame);
}
frameRequest = requestAnimationFrame(simulationFrame);

window.dispatchEvent(new Event('resize'));
bindGameToolContext(host.canvas, cityUi.toolContextSheet, bindings.signal);

// Keyboard shortcuts route through the City UI presentation seam so gameplay authority and
// contextual tool state stay synchronized even when the Build picker is closed.
const selectTool = (mode: GameToolMode): void => cityUi.selectTool(mode);
const selectBrush = (size: TerraformBrushSize): void => {
  currentBrushSize = size;
  const shellBrush = root.querySelector<HTMLButtonElement>(`[data-brush-size="${size}"]`);
  if (shellBrush !== null) shellBrush.click();
  else runtime.setTerraformBrush(size);
};
bindGameKeyboardShortcuts(
  window,
  {
    selectTool,
    getBrush: () => currentBrushSize,
    selectBrush,
    requestUndo: () => runtime.undo(),
    cancelPreviewOrCloseTool,
  },
  bindings.signal,
);

document.addEventListener(
  'visibilitychange',
  () => {
    simulationRuntime.resetAfterVisibilityChange();
    previousFrameTimestamp = null;
    if (document.visibilityState === 'hidden') dispatchGameToolCancel(host.canvas);
  },
  { signal: bindings.signal },
);

window.addEventListener(
  'pagehide',
  () => {
    cancelAnimationFrame(frameRequest);
    unsubscribeCommittedWorld();
    unsubscribeWorldSelection();
    trafficRuntime?.dispose();
    cityUi.dispose();
    bindings.abort();
    runtime.dispose();
    delete timeWindow.__WEB_THREE_CITY_TIME__;
    delete timeWindow.__WEB_THREE_CITY_TRAFFIC__;
  },
  { once: true },
);
