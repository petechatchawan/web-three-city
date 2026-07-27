import { OrthographicCameraRig } from '@web-three-city/camera-input';
import {
  decodeTerrainSaveV1,
  encodeTerrainSaveV1,
  type TerrainSnapshot,
} from '@web-three-city/terrain-core';
import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import {
  createCoreTerrainPresentationSource,
  detectWebGL2,
  SelectedCellPresentation,
  TerrainGridPresentation,
  TerrainPresentation,
} from '@web-three-city/terrain-three';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import * as THREE from 'three';
import { createGameInput, type GameRenderViewport } from './game-input.js';
import { publishInteractionEvidence } from './interaction-evidence.js';
import { renderGameUi, type GameViewportLayout, type QualityLevel } from './game-ui.js';

const SAVE_KEY = 'web-three-city:terrain-save:v1';
const CURATED_SEED = 1464156977;
const WORLD_BOUNDS = Object.freeze({
  minimumWorldY: WORLD_CONFIG.dioramaBaseY,
  maximumWorldY: WORLD_CONFIG.maxHeightLevel * WORLD_CONFIG.heightStep,
});

const QUALITY_POLICY = Object.freeze({
  low: { label: 'Low', maxPixelRatio: 1, shadows: false },
  medium: { label: 'Medium', maxPixelRatio: 1.5, shadows: true },
  high: { label: 'High', maxPixelRatio: 2, shadows: true },
});

export interface GameRuntime {
  dispose(): void;
}

function toRenderViewport(layout: GameViewportLayout): GameRenderViewport {
  return {
    left: layout.insets.left,
    top: layout.insets.top,
    width: layout.width - layout.insets.left - layout.insets.right,
    height: layout.height - layout.insets.top - layout.insets.bottom,
    canvasWidth: layout.width,
    canvasHeight: layout.height,
  };
}

function rebuildSelection(
  selection: SelectedCellPresentation,
  snapshot: TerrainSnapshot,
  selectedCell: CellCoord | null,
): void {
  selection.clear();
  if (selectedCell !== null) selection.setSelection(snapshot, selectedCell);
}

export function bootstrapGame(root: HTMLElement): GameRuntime {
  const ui = renderGameUi(root);
  const capability = detectWebGL2(ui.canvas);
  if (!capability.supported) {
    ui.setStatus('WebGL2 unavailable');
    return { dispose(): void {} };
  }

  const generated = generateCoastalTerrain({ seed: CURATED_SEED, config: WORLD_CONFIG });
  if (!generated.ok) throw new Error(`game:generation-failed:${generated.error.code}`);
  let snapshot = generated.value;
  let selectedCell: CellCoord | null = null;
  let contextLost = false;
  let disposed = false;
  let animationFrame = 0;
  let renderViewport: GameRenderViewport = {
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    canvasWidth: 1,
    canvasHeight: 1,
  };

  const renderer = new THREE.WebGLRenderer({
    canvas: ui.canvas,
    context: capability.context,
    antialias: true,
  });
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xcfe4ef, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe4ef);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4f5b45, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-60, 100, -30);
  scene.add(sun);

  const camera = new THREE.OrthographicCamera();
  const cameraRig = new OrthographicCameraRig(camera, WORLD_CONFIG);
  const terrain = new TerrainPresentation(
    scene,
    createCoreTerrainPresentationSource(WORLD_CONFIG),
    WORLD_CONFIG,
  );
  terrain.load(snapshot);
  const grid = new TerrainGridPresentation(scene, WORLD_CONFIG);
  grid.setVisible(false);
  grid.load(snapshot);
  const selection = new SelectedCellPresentation(scene, WORLD_CONFIG);

  const setSelection = (cell: CellCoord | null): void => {
    selectedCell = cell === null ? null : { ...cell };
    ui.setSelectedCell(selectedCell);
    if (selectedCell === null) selection.clear();
    else selection.setSelection(snapshot, selectedCell);
  };

  const inputRef: { current: ReturnType<typeof createGameInput> | null } = { current: null };
  const resetCamera = (): void => {
    const layout = ui.measureViewport();
    ui.setControlsMode(layout.mode);
    cameraRig.setViewport(layout.width, layout.height, layout.insets);
    cameraRig.resetToFit(WORLD_BOUNDS);
    renderViewport = toRenderViewport(layout);
    inputRef.current?.setViewport(renderViewport);
  };

  const input = createGameInput({
    canvas: ui.canvas,
    camera,
    cameraRig,
    terrain,
    config: WORLD_CONFIG,
    onSelection: setSelection,
    onReset: resetCamera,
  });
  inputRef.current = input;

  let viewportInitialized = false;
  const updateViewport = (): void => {
    const layout = ui.measureViewport();
    ui.setControlsMode(layout.mode);
    renderer.setSize(layout.width, layout.height, false);
    if (viewportInitialized) {
      cameraRig.resizePreservingRelativeZoom(
        layout.width,
        layout.height,
        layout.insets,
        WORLD_BOUNDS,
      );
    } else {
      cameraRig.setViewport(layout.width, layout.height, layout.insets);
      cameraRig.fitToWorld(WORLD_BOUNDS);
      viewportInitialized = true;
    }
    renderViewport = toRenderViewport(layout);
    input.setViewport(renderViewport);
  };

  const applyQuality = (quality: QualityLevel): void => {
    const policy = QUALITY_POLICY[quality];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, policy.maxPixelRatio));
    renderer.shadowMap.enabled = policy.shadows;
    ui.setQuality(policy.label);
    updateViewport();
  };

  updateViewport();
  applyQuality('medium');

  const abortController = new AbortController();
  const listenerOptions = { signal: abortController.signal };

  ui.qualitySelect.addEventListener(
    'change',
    () => applyQuality(ui.qualitySelect.value as QualityLevel),
    listenerOptions,
  );
  ui.saveButton.addEventListener(
    'click',
    () => {
      localStorage.setItem(SAVE_KEY, JSON.stringify(encodeTerrainSaveV1(snapshot)));
      ui.setStatus('Saved');
    },
    listenerOptions,
  );
  ui.loadButton.addEventListener(
    'click',
    () => {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved === null) {
        ui.setStatus('No save');
        return;
      }
      try {
        const decoded = decodeTerrainSaveV1(JSON.parse(saved) as unknown);
        if (!decoded.ok) {
          ui.setStatus('Invalid save');
          return;
        }
        snapshot = decoded.value;
        terrain.load(snapshot);
        grid.load(snapshot);
        rebuildSelection(selection, snapshot, selectedCell);
        input.refreshTerrainObjects();
        ui.setStatus('Loaded');
      } catch {
        ui.setStatus('Invalid save');
      }
    },
    listenerOptions,
  );
  ui.rotateLeftButton.addEventListener(
    'click',
    () => input.controller.rotateLeft(),
    listenerOptions,
  );
  ui.rotateRightButton.addEventListener(
    'click',
    () => input.controller.rotateRight(),
    listenerOptions,
  );
  ui.resetButton.addEventListener('click', resetCamera, listenerOptions);
  ui.gridButton.addEventListener(
    'click',
    () => {
      grid.setVisible(!grid.visible);
      ui.setGridVisible(grid.visible);
    },
    listenerOptions,
  );
  window.addEventListener('resize', updateViewport, listenerOptions);

  ui.canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      contextLost = true;
      input.clearActiveSession();
      ui.setStatus('Context lost');
    },
    listenerOptions,
  );
  ui.canvas.addEventListener(
    'webglcontextrestored',
    () => {
      terrain.load(snapshot);
      grid.load(snapshot);
      rebuildSelection(selection, snapshot, selectedCell);
      input.refreshTerrainObjects();
      contextLost = false;
      ui.setStatus('Ready');
    },
    listenerOptions,
  );

  publishInteractionEvidence({
    camera,
    cameraRig,
    config: WORLD_CONFIG,
    scene,
    input,
    getViewport: () => renderViewport,
    getSelectedCell: () => selectedCell,
    getGridVisible: () => grid.visible,
  });

  const render = (): void => {
    if (!contextLost) {
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, renderViewport.canvasWidth, renderViewport.canvasHeight);
      renderer.clear(true, true, true);
      const viewportBottom =
        renderViewport.canvasHeight - renderViewport.top - renderViewport.height;
      renderer.setViewport(
        renderViewport.left,
        viewportBottom,
        renderViewport.width,
        renderViewport.height,
      );
      renderer.setScissor(
        renderViewport.left,
        viewportBottom,
        renderViewport.width,
        renderViewport.height,
      );
      renderer.setScissorTest(true);
      renderer.render(scene, camera);
    }
    animationFrame = window.requestAnimationFrame(render);
  };

  ui.setGridVisible(false);
  ui.setSelectedCell(null);
  ui.setStatus('Ready');
  render();

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    abortController.abort();
    window.cancelAnimationFrame(animationFrame);
    input.dispose();
    selection.dispose();
    grid.dispose();
    terrain.dispose();
    renderer.dispose();
    delete window.__WEB_THREE_CITY_INTERACTION__;
  };
  window.addEventListener('pagehide', dispose, { once: true });

  return { dispose };
}
