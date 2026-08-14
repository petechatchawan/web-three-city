import './style.css';
import './ui/foundation/tokens.css';
import './ui/city-ui.css';
import './ui/m6-3-figma.css';
import './ui/m6-3-fidelity-remediation.css';
import { constructionProgressAtTick } from '@web-three-city/building-core';
import {
  constructionVisualPhase,
  reloadLatestBuildingPresentation,
  setBuildingPresentationAbsoluteTick,
} from '@web-three-city/building-three';
import { createFoundationRciRegistries } from '@web-three-city/rci-core';
import type { SimulationSpeed } from '@web-three-city/simulation-core';
import type { TerraformBrushSize } from '@web-three-city/terrain-core';
import { bootstrapGame } from './game-bootstrap.js';
import { renderGameCanvas } from './game-ui.js';
import { bindGameKeyboardShortcuts } from './game-keyboard-shortcuts.js';
import { createSimulationRuntime } from './simulation-runtime.js';
import { dispatchGameToolCancel } from './game-tool-events.js';
import { bindGameToolContext } from './game-tool-context-bridge.js';
import type { GameToolMode } from './game-tool-mode.js';
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
  readonly setAutomaticGrowthEnabled: (enabled: boolean) => void;
  readonly resetForTest: () => void;
}

type GameTimeWindow = Window & {
  __WEB_THREE_CITY_TIME__?: GameTimeTestApi;
};

const rootElement = document.querySelector<HTMLElement>('#app');
if (rootElement === null) throw new Error('game:missing-root');
const root: HTMLElement = rootElement;
const host = renderGameCanvas(root);
const runtime = bootstrapGame(host);
const rciRegistries = createFoundationRciRegistries();

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
  } else {
    const activeNav = root.querySelector<HTMLButtonElement>(
      '.city-bottom-nav [data-nav-category][aria-pressed="true"]',
    );
    if (activeNav !== null) activeNav.click();
    else runtime.selectTool('navigate');
  }
}

const simulationRuntime = createSimulationRuntime('paused');
let previousFrameTimestamp: number | null = null;
let frameRequest = 0;
const phaseByInstance = new Map<string, string>();

function refreshConstructionPhaseIfNeeded(world = runtime.snapshot()): void {
  let changed = false;
  const next = new Map<string, string>();
  for (const instance of world.buildings.instances) {
    const phase =
      instance.lifecycle === 'construction'
        ? constructionVisualPhase(
            constructionProgressAtTick(instance, world.simulation.absoluteTick),
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
  if (reason === 'load') {
    setSimulationSpeed('paused');
    simulationRuntime.resetAfterVisibilityChange();
  }
  setBuildingPresentationAbsoluteTick(world.simulation.absoluteTick);
  refreshConstructionPhaseIfNeeded(world);
  cityUi.update(world);
}

function advanceOneLogicalTick(): void {
  runtime.advanceLogicalTick({ automaticGrowth: automaticGrowthEnabled });
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
  setBuildingPresentationAbsoluteTick(world.simulation.absoluteTick);
  refreshConstructionPhaseIfNeeded(world);
}

const cityUi = mountCityUi(root, {
  setSpeed: setSimulationSpeed,
  selectTool: (mode) => runtime.selectTool(mode),
  setTerraformBrush: (size) => {
    currentBrushSize = size;
    runtime.setTerraformBrush(size);
  },
  submitTaxPolicy: (policy) => runtime.submitTaxPolicy(policy),
  setInformationView: (key) => runtime.setInformationView(key),
  saveWorld: () => runtime.saveWorld(),
  loadWorld: () => runtime.loadWorld(),
  rotateLeft: () => runtime.rotateLeft(),
  rotateRight: () => runtime.rotateRight(),
  resetCamera: () => runtime.resetCamera(),
  toggleGrid: () => runtime.toggleGrid(),
  setQuality: (quality) => runtime.setQuality(quality),
  step: () => {
    simulationRuntime.step(advanceOneLogicalTick);
  },
  undo: () => runtime.undo(),
  rciRegistries,
});

// Bootstrap completion/status feeds land on the compact M6.3 context surface.
host.onStatus((value) => cityUi.toolContextSheet.setStatus(value));
host.onUndoAvailable((available) => cityUi.toolContextSheet.setUndoAvailable(available));

const unsubscribeCommittedWorld = runtime.subscribeCommittedWorld(synchronizeCommittedWorld);
const unsubscribeWorldSelection = runtime.subscribeWorldSelection((cell) =>
  cityUi.inspectCell(cell),
);
const initialWorld = runtime.snapshot();
cityUi.update(initialWorld);
setBuildingPresentationAbsoluteTick(initialWorld.simulation.absoluteTick);
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

window.dispatchEvent(new Event('resize'));
bindGameToolContext(host.canvas, cityUi.toolContextSheet, bindings.signal);

// Keyboard shortcuts drive the contextual tool tray when it is mounted, falling back to
// the runtime directly when the requested tool is not currently exposed in presentation.
const selectTool = (mode: GameToolMode): void => {
  const shellTool = root.querySelector<HTMLButtonElement>(`[data-toolMode="${mode}"]`);
  if (shellTool !== null) shellTool.click();
  else runtime.selectTool(mode);
};
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
    cityUi.dispose();
    bindings.abort();
    runtime.dispose();
    delete timeWindow.__WEB_THREE_CITY_TIME__;
  },
  { once: true },
);
