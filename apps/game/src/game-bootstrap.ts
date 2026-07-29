import { OrthographicCameraRig } from '@web-three-city/camera-input';
import {
  commitTerraformPlan,
  decodeTerrainSaveV1,
  encodeTerrainSaveV1,
  TerraformUndoStore,
  type TerrainSnapshot,
  type TerraformBrushSize,
  type TerraformPlan,
  type WorldToolMode,
} from '@web-three-city/terrain-core';
import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import {
  createCoreTerrainPresentationSource,
  detectWebGL2,
  SelectedCellPresentation,
  TerrainGridPresentation,
  TerrainPresentation,
  TerraformPreviewPresentation,
} from '@web-three-city/terrain-three';
import { deriveWaterSnapshot, type WaterSnapshot } from '@web-three-city/water-core';
import {
  createCoreWaterPresentationSource,
  WaterPresentation,
  type WaterPresentationBuild,
  type WaterPresentationSource,
} from '@web-three-city/water-three';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import * as THREE from 'three';
import { createGameInput, type GameRenderViewport } from './game-input.js';
import {
  publishInteractionEvidence,
  type WaterInteractionEvidence,
} from './interaction-evidence.js';
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

type WaterBuildMetrics = Pick<
  WaterInteractionEvidence,
  'surfaceTriangleCount' | 'shorelineTriangleCount' | 'wallSegmentCount' | 'estimatedGeometryBytes'
>;

function summarizeWaterBuild(build: WaterPresentationBuild): WaterBuildMetrics {
  let surfaceTriangleCount = 0;
  let shorelineTriangleCount = 0;
  let estimatedGeometryBytes = 0;
  for (const chunk of build.chunks) {
    surfaceTriangleCount += chunk.surfaceTriangleCount;
    shorelineTriangleCount += chunk.shorelineTriangleCount;
    estimatedGeometryBytes +=
      chunk.surfacePositions.byteLength +
      chunk.surfaceNormals.byteLength +
      chunk.surfaceColors.byteLength +
      chunk.surfaceIndices.byteLength +
      chunk.shorelinePositions.byteLength +
      chunk.shorelineColors.byteLength +
      chunk.shorelineIndices.byteLength;
  }
  estimatedGeometryBytes +=
    build.wall.positions.byteLength +
    build.wall.normals.byteLength +
    build.wall.colors.byteLength +
    build.wall.indices.byteLength;
  return {
    surfaceTriangleCount,
    shorelineTriangleCount,
    wallSegmentCount: build.wall.segmentCount,
    estimatedGeometryBytes,
  };
}

function requireWater(snapshot: TerrainSnapshot): WaterSnapshot {
  const result = deriveWaterSnapshot(snapshot, WORLD_CONFIG);
  if (!result.ok) throw new Error(`game:water-derivation-failed:${result.error.code}`);
  return result.value;
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
  const initialWaterDerivationStart = performance.now();
  let waterSnapshot = requireWater(snapshot);
  let waterDerivationDurationMs = performance.now() - initialWaterDerivationStart;
  let waterPresentationDurationMs = 0;
  let waterBuildMetrics: WaterBuildMetrics = {
    surfaceTriangleCount: 0,
    shorelineTriangleCount: 0,
    wallSegmentCount: 0,
    estimatedGeometryBytes: 0,
  };
  let stagedWaterBuildMetrics = waterBuildMetrics;
  let replacingWorld = false;
  let selectedCell: CellCoord | null = null;
  let contextLost = false;
  let disposed = false;
  let animationFrame = 0;
  let terraformCommitCount = 0;
  let terraformUndoCount = 0;
  let terraformWaterRebuildCount = 0;
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
  const coreWaterSource = createCoreWaterPresentationSource(WORLD_CONFIG);
  const measuredWaterSource: WaterPresentationSource = {
    buildAll(terrainSnapshot, nextWaterSnapshot) {
      const build = coreWaterSource.buildAll(terrainSnapshot, nextWaterSnapshot);
      stagedWaterBuildMetrics = summarizeWaterBuild(build);
      return build;
    },
  };
  const water = new WaterPresentation(scene, measuredWaterSource, WORLD_CONFIG);
  terrain.load(snapshot);
  const initialWaterPresentationStart = performance.now();
  water.load(snapshot, waterSnapshot);
  waterPresentationDurationMs = performance.now() - initialWaterPresentationStart;
  waterBuildMetrics = stagedWaterBuildMetrics;
  const grid = new TerrainGridPresentation(scene, WORLD_CONFIG);
  grid.setVisible(false);
  grid.load(snapshot);
  const selection = new SelectedCellPresentation(scene, WORLD_CONFIG);
  const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);
  const undoStore = new TerraformUndoStore();

  const setSelection = (cell: CellCoord | null): void => {
    selectedCell = cell === null ? null : { ...cell };
    ui.setSelectedCell(selectedCell);
    if (selectedCell === null) selection.clear();
    else selection.setSelection(snapshot, selectedCell);
  };

  const inputRef: { current: ReturnType<typeof createGameInput> | null } = { current: null };

  const replaceWorld = (nextSnapshot: TerrainSnapshot, successStatus: string): boolean => {
    const derivationStart = performance.now();
    const nextWaterResult = deriveWaterSnapshot(nextSnapshot, WORLD_CONFIG);
    const nextWaterDerivationDurationMs = performance.now() - derivationStart;
    if (!nextWaterResult.ok) {
      ui.setStatus('World update failed');
      return false;
    }

    const previousSnapshot = snapshot;
    const previousWaterSnapshot = waterSnapshot;
    replacingWorld = true;
    try {
      terrain.load(nextSnapshot);
      const presentationStart = performance.now();
      water.load(nextSnapshot, nextWaterResult.value);
      const nextWaterPresentationDurationMs = performance.now() - presentationStart;
      grid.load(nextSnapshot);
      rebuildSelection(selection, nextSnapshot, selectedCell);
      inputRef.current?.refreshTerrainObjects();

      snapshot = nextSnapshot;
      waterSnapshot = nextWaterResult.value;
      waterDerivationDurationMs = nextWaterDerivationDurationMs;
      waterPresentationDurationMs = nextWaterPresentationDurationMs;
      waterBuildMetrics = stagedWaterBuildMetrics;
      ui.setStatus(successStatus);
      return true;
    } catch {
      try {
        terrain.load(previousSnapshot);
        water.load(previousSnapshot, previousWaterSnapshot);
        grid.load(previousSnapshot);
        rebuildSelection(selection, previousSnapshot, selectedCell);
        inputRef.current?.refreshTerrainObjects();
        waterBuildMetrics = stagedWaterBuildMetrics;
      } catch {
        // Preserve the original failure status; context restoration can rebuild the committed world.
      }
      ui.setStatus('World update failed');
      return false;
    } finally {
      replacingWorld = false;
    }
  };

  const applyTerraformPlan = (plan: TerraformPlan): void => {
    try {
      const committed = commitTerraformPlan(snapshot, plan, WORLD_CONFIG);
      undoStore.captureBeforeCommit(snapshot);
      if (replaceWorld(committed.snapshot, 'Terraform applied')) {
        terraformCommitCount += 1;
        terraformWaterRebuildCount += 1;
      } else {
        undoStore.clear();
      }
    } catch {
      ui.setStatus('Terraform rejected');
    }
    ui.setUndoAvailable(undoStore.available);
  };

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
    preview,
    config: WORLD_CONFIG,
    getTerrainSnapshot: () => snapshot,
    onSelection: setSelection,
    onTerraformCommit: applyTerraformPlan,
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

  const setToolMode = (mode: WorldToolMode): void => {
    input.setToolMode(mode);
    ui.setToolMode(mode);
    if (mode !== 'navigate' && !grid.visible) {
      grid.setVisible(true);
      ui.setGridVisible(true);
    }
  };

  const setBrushSize = (size: TerraformBrushSize): void => {
    input.setBrushSize(size);
    ui.setBrushSize(size);
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
      input.clearActiveSession();
      localStorage.setItem(SAVE_KEY, JSON.stringify(encodeTerrainSaveV1(snapshot)));
      ui.setStatus('Saved');
    },
    listenerOptions,
  );
  ui.loadButton.addEventListener(
    'click',
    () => {
      input.clearActiveSession();
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
        if (replaceWorld(decoded.value, 'Loaded')) {
          undoStore.clear();
          ui.setUndoAvailable(false);
        }
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
  ui.navigateButton.addEventListener('click', () => setToolMode('navigate'), listenerOptions);
  ui.raiseButton.addEventListener('click', () => setToolMode('raise'), listenerOptions);
  ui.lowerButton.addEventListener('click', () => setToolMode('lower'), listenerOptions);
  ui.flattenButton.addEventListener('click', () => setToolMode('flatten'), listenerOptions);
  ui.brush1Button.addEventListener('click', () => setBrushSize(1), listenerOptions);
  ui.brush3Button.addEventListener('click', () => setBrushSize(3), listenerOptions);
  ui.brush5Button.addEventListener('click', () => setBrushSize(5), listenerOptions);
  ui.undoButton.addEventListener(
    'click',
    () => {
      input.clearActiveSession();
      const restored = undoStore.undo(snapshot, WORLD_CONFIG);
      if (restored === null) return;
      if (replaceWorld(restored, 'Terraform undone')) {
        terraformUndoCount += 1;
        terraformWaterRebuildCount += 1;
      }
      ui.setUndoAvailable(undoStore.available);
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
      preview.clear();
      terrain.load(snapshot);
      const presentationStart = performance.now();
      water.load(snapshot, waterSnapshot);
      waterPresentationDurationMs = performance.now() - presentationStart;
      waterBuildMetrics = stagedWaterBuildMetrics;
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
    getWaterEvidence: () => ({
      sourceTerrainRevision: waterSnapshot.sourceTerrainRevision,
      seaTriangleCount: waterSnapshot.seaTriangleCount,
      enclosedWetTriangleCount: waterSnapshot.enclosedWetTriangleCount,
      shorelineSegmentCount: waterSnapshot.shorelineSegmentCount,
      ...waterBuildMetrics,
      derivationDurationMs: waterDerivationDurationMs,
      presentationDurationMs: waterPresentationDurationMs,
    }),
    getTerraformEvidence: () => {
      const state = input.getTerraformState();
      return {
        ...state,
        committedTerrainRevision: snapshot.revision,
        waterSourceTerrainRevision: waterSnapshot.sourceTerrainRevision,
        undoAvailable: undoStore.available,
        commitCount: terraformCommitCount,
        undoCount: terraformUndoCount,
        waterRebuildCount: terraformWaterRebuildCount,
      };
    },
  });

  const render = (): void => {
    if (!contextLost && !replacingWorld) {
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
  ui.setToolMode('navigate');
  ui.setBrushSize(1);
  ui.setUndoAvailable(false);
  ui.setStatus('Ready');
  render();

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    abortController.abort();
    window.cancelAnimationFrame(animationFrame);
    input.dispose();
    preview.dispose();
    selection.dispose();
    grid.dispose();
    water.dispose();
    terrain.dispose();
    renderer.dispose();
    delete window.__WEB_THREE_CITY_INTERACTION__;
  };
  window.addEventListener('pagehide', dispose, { once: true });

  return { dispose };
}
