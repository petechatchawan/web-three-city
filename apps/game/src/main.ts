import './style.css';
import './growth-time.css';
import {
  constructionProgressAtTick,
  createEmptyBuildingSnapshot,
} from '@web-three-city/building-core';
import {
  constructionVisualPhase,
  latestPresentedBuildingSnapshot,
  reloadLatestBuildingPresentation,
  setBuildingPresentationAbsoluteTick,
} from '@web-three-city/building-three';
import {
  createInitialSimulationSnapshot,
  type SimulationSnapshot,
  type SimulationSpeed,
} from '@web-three-city/simulation-core';
import type { TerraformBrushSize } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
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
import { decodeWorldSave } from './world-save.js';

const CURRENT_WORLD_SAVE_KEY = 'web-three-city:world-save:v5';
const WORLD_SAVE_KEYS = Object.freeze([
  CURRENT_WORLD_SAVE_KEY,
  'web-three-city:world-save:v3',
  'web-three-city:world-save:v2',
  'web-three-city:world-save:v1',
  'web-three-city:terrain-save:v1',
]);

interface GameTimeTestApi {
  readonly snapshot: () => Readonly<{
    readonly simulation: SimulationSnapshot;
    readonly speed: SimulationSpeed;
    readonly buildingCount: number;
  }>;
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
const loadButton = requireButton('load');
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

let simulation: SimulationSnapshot = createInitialSimulationSnapshot();
const simulationRuntime = createSimulationRuntime('normal');
let previousFrameTimestamp: number | null = null;
let frameRequest = 0;
const phaseByInstance = new Map<string, string>();

function currentBuildings() {
  return latestPresentedBuildingSnapshot() ?? createEmptyBuildingSnapshot(WORLD_CONFIG);
}

function refreshTimeUi(): void {
  timeUi.update(
    simulationRuntime.getState().speed,
    createGameTimePresentation(simulation, currentBuildings()),
  );
}

function refreshConstructionPhaseIfNeeded(): void {
  const snapshot = currentBuildings();
  let changed = false;
  const next = new Map<string, string>();
  for (const instance of snapshot.instances) {
    const phase =
      instance.lifecycle === 'construction'
        ? constructionVisualPhase(constructionProgressAtTick(instance, simulation.absoluteTick))
        : 'active';
    next.set(instance.instanceId, phase);
    if (phaseByInstance.get(instance.instanceId) !== phase) changed = true;
  }
  if (phaseByInstance.size !== next.size) changed = true;
  phaseByInstance.clear();
  for (const [instanceId, phase] of next) phaseByInstance.set(instanceId, phase);
  if (changed) reloadLatestBuildingPresentation();
}

function advanceOneLogicalTick(): void {
  simulation = automaticGrowthEnabled
    ? runtime.runBackgroundGrowthTick(simulation)
    : runtime.runSimulationOnlyTick(simulation);
  setBuildingPresentationAbsoluteTick(simulation.absoluteTick);
  refreshConstructionPhaseIfNeeded();
  refreshTimeUi();
}

function setSimulationSpeed(speed: SimulationSpeed): void {
  simulationRuntime.setSpeed(speed);
  refreshTimeUi();
}

function resetSimulationForTest(): void {
  simulation = createInitialSimulationSnapshot();
  simulationRuntime.setSpeed('paused');
  simulationRuntime.resetAfterVisibilityChange();
  setBuildingPresentationAbsoluteTick(simulation.absoluteTick);
  phaseByInstance.clear();
  refreshConstructionPhaseIfNeeded();
  refreshTimeUi();
}

const timeUi = mountGameTimeUi(root, setSimulationSpeed, () => {
  simulationRuntime.step(advanceOneLogicalTick);
  refreshTimeUi();
});
setBuildingPresentationAbsoluteTick(simulation.absoluteTick);
refreshConstructionPhaseIfNeeded();
refreshTimeUi();

const timeWindow = window as GameTimeWindow;
timeWindow.__WEB_THREE_CITY_TIME__ = Object.freeze({
  snapshot: () =>
    Object.freeze({
      simulation,
      speed: simulationRuntime.getState().speed,
      buildingCount: currentBuildings().instances.length,
    }),
  setSpeed: setSimulationSpeed,
  step: () => simulationRuntime.step(advanceOneLogicalTick),
  setAutomaticGrowthEnabled(enabled: boolean): void {
    automaticGrowthEnabled = enabled;
  },
  resetForTest: resetSimulationForTest,
});

function readStoredWorld(): unknown | null {
  for (const key of WORLD_SAVE_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  return null;
}

loadButton.addEventListener(
  'click',
  () => {
    const decoded = decodeWorldSave(readStoredWorld(), WORLD_CONFIG);
    if (!decoded.ok) return;
    simulation = decoded.value.simulation;
    simulationRuntime.setSpeed('paused');
    simulationRuntime.resetAfterVisibilityChange();
    setBuildingPresentationAbsoluteTick(simulation.absoluteTick);
    reloadLatestBuildingPresentation();
    refreshConstructionPhaseIfNeeded();
    refreshTimeUi();
  },
  { signal: bindings.signal },
);

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
    timeUi.dispose();
    bindings.abort();
    runtime.dispose();
    delete timeWindow.__WEB_THREE_CITY_TIME__;
  },
  { once: true },
);
