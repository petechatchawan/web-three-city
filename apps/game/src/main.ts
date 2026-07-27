import { OrthographicCameraRig } from '@web-three-city/camera-input';
import { decodeTerrainSaveV1, encodeTerrainSaveV1 } from '@web-three-city/terrain-core';
import type { TerrainSnapshot } from '@web-three-city/terrain-core';
import { generateCoastalTerrain } from '@web-three-city/terrain-generator';
import {
  createCoreTerrainPresentationSource,
  detectWebGL2,
  TerrainPresentation,
} from '@web-three-city/terrain-three';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import * as THREE from 'three';
import './style.css';

const SAVE_KEY = 'web-three-city:terrain-save:v1';
const CURATED_SEED = 1464156977;

const root = document.querySelector<HTMLElement>('#app');
if (root === null) throw new Error('game:missing-root');

root.innerHTML = `
  <main class="app-shell">
    <canvas id="game-canvas" aria-label="City terrain viewport"></canvas>
    <section class="panel" aria-label="Game controls">
      <p class="eyebrow">Web Three City</p>
      <h1>Coastal terrain</h1>
      <p class="status">Status: <strong data-testid="game-status">Loading</strong></p>
      <label class="field" for="quality-select">
        <span>Quality</span>
        <select id="quality-select">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <p>Active quality: <strong data-testid="quality-value">Medium</strong></p>
      <div class="actions">
        <button type="button" data-action="save">Save terrain</button>
        <button type="button" data-action="load">Load terrain</button>
        <button type="button" data-action="rotate-left">Rotate left</button>
        <button type="button" data-action="rotate-right">Rotate right</button>
      </div>
    </section>
  </main>
`;

function requireElement<T extends Element>(selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`game:missing-element:${selector}`);
  return element;
}

const canvas = requireElement<HTMLCanvasElement>('#game-canvas');
const status = requireElement<HTMLElement>('[data-testid="game-status"]');
const qualityValue = requireElement<HTMLElement>('[data-testid="quality-value"]');
const qualitySelect = requireElement<HTMLSelectElement>('#quality-select');
const capability = detectWebGL2(canvas);

if (!capability.supported) {
  status.textContent = 'WebGL2 unavailable';
} else {
  const generated = generateCoastalTerrain({ seed: CURATED_SEED, config: WORLD_CONFIG });
  if (!generated.ok) throw new Error(`game:generation-failed:${generated.error.code}`);
  let snapshot: TerrainSnapshot = generated.value;
  let contextLost = false;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: capability.context,
    antialias: true,
  });
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
  presentation.load(snapshot);

  const qualityPolicy = {
    low: { label: 'Low', maxPixelRatio: 1, shadows: false },
    medium: { label: 'Medium', maxPixelRatio: 1.5, shadows: true },
    high: { label: 'High', maxPixelRatio: 2, shadows: true },
  } as const;

  const applyQuality = (quality: keyof typeof qualityPolicy): void => {
    const policy = qualityPolicy[quality];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, policy.maxPixelRatio));
    renderer.shadowMap.enabled = policy.shadows;
    qualityValue.textContent = policy.label;
  };
  applyQuality('medium');

  qualitySelect.addEventListener('change', () => {
    const quality = qualitySelect.value as keyof typeof qualityPolicy;
    applyQuality(quality);
  });

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
    if (!contextLost) renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(render);
  };
  render();

  requireElement<HTMLButtonElement>('[data-action="save"]').addEventListener('click', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(encodeTerrainSaveV1(snapshot)));
    status.textContent = 'Saved';
  });
  requireElement<HTMLButtonElement>('[data-action="load"]').addEventListener('click', () => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved === null) {
      status.textContent = 'No save';
      return;
    }
    try {
      const decoded = decodeTerrainSaveV1(JSON.parse(saved) as unknown);
      if (!decoded.ok) {
        status.textContent = 'Invalid save';
        return;
      }
      snapshot = decoded.value;
      presentation.load(snapshot);
      status.textContent = 'Loaded';
    } catch {
      status.textContent = 'Invalid save';
    }
  });
  requireElement<HTMLButtonElement>('[data-action="rotate-left"]').addEventListener('click', () => {
    cameraRig.rotateLeft();
  });
  requireElement<HTMLButtonElement>('[data-action="rotate-right"]').addEventListener('click', () => {
    cameraRig.rotateRight();
  });

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    status.textContent = 'Context lost';
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    presentation.load(snapshot);
    status.textContent = 'Ready';
  });

  status.textContent = 'Ready';

  window.addEventListener('pagehide', () => {
    window.cancelAnimationFrame(animationFrame);
    presentation.dispose();
    renderer.dispose();
  });
}
