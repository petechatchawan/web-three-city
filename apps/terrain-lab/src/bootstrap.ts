import { OrthographicCameraRig, pickTerrain } from '@web-three-city/camera-input';
import { allChunkCoords } from '@web-three-city/terrain-core';
import {
  createCoreTerrainPresentationSource,
  detectWebGL2,
  TerrainGridPresentation,
  TerrainPresentation,
} from '@web-three-city/terrain-three';
import { createCoreWaterPresentationSource, WaterPresentation } from '@web-three-city/water-three';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import * as THREE from 'three';
import { resolveFixture } from './fixture-registry.js';

interface TerrainLabWaterEvidence {
  readonly fixture: string;
  readonly sourceTerrainRevision: number;
  readonly seaTriangleCount: number;
  readonly enclosedWetTriangleCount: number;
  readonly shorelineSegmentCount: number;
  readonly waterRootCount: number;
}

interface TerrainLabEvidence {
  readonly fixture: string;
  readonly generationMs: number;
  readonly presentationMs: number;
  readonly chunkCount: number;
  readonly surfaceTriangleCount: number;
  readonly latticeByteLength: number;
  readonly renderer: string;
}

declare global {
  interface Window {
    __WEB_THREE_CITY_EVIDENCE__?: TerrainLabEvidence;
    __WEB_THREE_CITY_WATER_EVIDENCE__?: TerrainLabWaterEvidence;
  }
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`terrain-lab:missing-element:${selector}`);
  return element;
}

export function bootstrapTerrainLab(root: HTMLElement): void {
  root.innerHTML = `
    <main class="app-shell">
      <canvas id="terrain-canvas" aria-label="Terrain viewport"></canvas>
      <section class="panel" aria-label="Terrain diagnostics">
        <p class="eyebrow">Web Terrain Foundation v0.1</p>
        <h1 data-testid="fixture-name">Loading</h1>
        <dl class="metrics">
          <div><dt>Status</dt><dd data-testid="terrain-status">Loading</dd></div>
          <div><dt>Water</dt><dd data-testid="water-status">Loading</dd></div>
          <div><dt>Camera</dt><dd data-testid="camera-rotation">0°</dd></div>
          <div><dt>Selected</dt><dd data-testid="selected-cell">None</dd></div>
        </dl>
        <div class="actions">
          <button type="button" data-action="rotate-left">Rotate left</button>
          <button type="button" data-action="rotate-right">Rotate right</button>
          <button type="button" data-action="reset">Reset camera</button>
        </div>
      </section>
    </main>
  `;

  const canvas = requireElement<HTMLCanvasElement>(root, '#terrain-canvas');
  const fixtureName = requireElement<HTMLElement>(root, '[data-testid="fixture-name"]');
  const status = requireElement<HTMLElement>(root, '[data-testid="terrain-status"]');
  const waterStatus = requireElement<HTMLElement>(root, '[data-testid="water-status"]');
  const rotation = requireElement<HTMLElement>(root, '[data-testid="camera-rotation"]');
  const selected = requireElement<HTMLElement>(root, '[data-testid="selected-cell"]');
  const capability = detectWebGL2(canvas);
  if (!capability.supported) {
    status.textContent = 'WebGL2 unavailable';
    waterStatus.textContent = 'Unavailable';
    return;
  }

  const parameters = new URLSearchParams(window.location.search);
  const generationStart = performance.now();
  const fixture = resolveFixture(parameters.get('fixture'), parameters.get('shape'));
  const waterResult = deriveWaterSnapshot(fixture.snapshot, WORLD_CONFIG);
  if (!waterResult.ok)
    throw new Error(`terrain-lab:water-derivation-failed:${waterResult.error.code}`);
  const waterSnapshot = waterResult.value;
  const generationMs = performance.now() - generationStart;
  fixtureName.textContent = fixture.name;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: capability.context,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe4ef);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4f5b45, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-60, 100, -30);
  scene.add(sun);

  const camera = new THREE.OrthographicCamera();
  const cameraRig = new OrthographicCameraRig(camera, WORLD_CONFIG);
  const presentation = new TerrainPresentation(
    scene,
    createCoreTerrainPresentationSource(WORLD_CONFIG),
    WORLD_CONFIG,
  );
  const presentationStart = performance.now();
  presentation.load(fixture.snapshot);
  const water = new WaterPresentation(
    scene,
    createCoreWaterPresentationSource(WORLD_CONFIG),
    WORLD_CONFIG,
  );
  water.load(fixture.snapshot, waterSnapshot);
  const presentationMs = performance.now() - presentationStart;

  const grid = new TerrainGridPresentation(scene, WORLD_CONFIG);
  grid.load(fixture.snapshot);
  grid.setVisible(true);

  const resize = (): void => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    cameraRig.resize(width, height);
  };
  resize();
  window.addEventListener('resize', resize);

  let animationFrame = 0;
  const render = (): void => {
    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(render);
  };
  render();

  const updateRotation = (): void => {
    rotation.textContent = `${cameraRig.state.yawQuarterTurns * 90}°`;
  };
  requireElement<HTMLButtonElement>(root, '[data-action="rotate-left"]').addEventListener(
    'click',
    () => {
      cameraRig.rotateLeft();
      updateRotation();
    },
  );
  requireElement<HTMLButtonElement>(root, '[data-action="rotate-right"]').addEventListener(
    'click',
    () => {
      cameraRig.rotateRight();
      updateRotation();
    },
  );
  requireElement<HTMLButtonElement>(root, '[data-action="reset"]').addEventListener('click', () => {
    cameraRig.reset();
    updateRotation();
  });

  const raycaster = new THREE.Raycaster();
  canvas.addEventListener('click', (event) => {
    const bounds = canvas.getBoundingClientRect();
    const result = pickTerrain({
      raycaster,
      camera,
      ndc: {
        x: ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        y: -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      },
      objects: allChunkCoords(WORLD_CONFIG).map((chunk) => presentation.getChunkMesh(chunk)),
      config: WORLD_CONFIG,
    });
    selected.textContent = result === null ? 'None' : `${result.cellX}, ${result.cellZ}`;
  });

  window.__WEB_THREE_CITY_WATER_EVIDENCE__ = {
    fixture: fixture.id,
    sourceTerrainRevision: waterSnapshot.sourceTerrainRevision,
    seaTriangleCount: waterSnapshot.seaTriangleCount,
    enclosedWetTriangleCount: waterSnapshot.enclosedWetTriangleCount,
    shorelineSegmentCount: waterSnapshot.shorelineSegmentCount,
    waterRootCount: scene.children.filter((node) => node.name === 'water-presentation-root').length,
  };

  window.__WEB_THREE_CITY_EVIDENCE__ = {
    fixture: fixture.name,
    generationMs,
    presentationMs,
    chunkCount: 64,
    surfaceTriangleCount: WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight * 2,
    latticeByteLength: fixture.snapshot.heightLevels.byteLength,
    renderer: renderer.info.programs === null ? 'WebGL2' : 'WebGL2 / Three.js',
  };
  status.textContent = 'Ready';
  waterStatus.textContent = 'Ready';

  window.addEventListener('pagehide', () => {
    window.cancelAnimationFrame(animationFrame);
    grid.dispose();
    water.dispose();
    presentation.dispose();
    renderer.dispose();
  });
}
