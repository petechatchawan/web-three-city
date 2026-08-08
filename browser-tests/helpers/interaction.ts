import { createHash } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import {
  OrthographicCameraRig,
  type CameraState,
  type ViewportInsets,
} from '../../packages/camera-input/src/index.js';
import { createCoreWaterPresentationSource } from '../../packages/water-three/src/index.js';
import type { InteractionEvidence } from '../../apps/game/src/interaction-evidence.js';
import * as THREE from 'three';
import {
  CELL_TRIANGLES,
  GAME_TERRAIN,
  WORLD_CONFIG,
  deriveWaterSnapshot,
  selectTerrainDiagonal,
  type TerrainCorner,
  type TerrainSnapshot,
} from './domain-fixtures.js';

export const GAME_URL = 'http://127.0.0.1:4174/';
export const TERRAIN_LAB_URL = 'http://127.0.0.1:4173/';

const CORNER_OFFSETS: Readonly<Record<TerrainCorner, Readonly<{ x: number; z: number }>>> =
  Object.freeze({
    nw: Object.freeze({ x: 0, z: 0 }),
    ne: Object.freeze({ x: 1, z: 0 }),
    sw: Object.freeze({ x: 0, z: 1 }),
    se: Object.freeze({ x: 1, z: 1 }),
  });

export interface TerrainLabWaterEvidence {
  readonly fixture: string;
  readonly sourceTerrainRevision: number;
  readonly seaTriangleCount: number;
  readonly enclosedWetTriangleCount: number;
  readonly shorelineSegmentCount: number;
  readonly waterRootCount: number;
}

export interface DeterministicWaterGeometryEvidence {
  readonly seaTriangleCount: number;
  readonly enclosedWetTriangleCount: number;
  readonly shorelineSegmentCount: number;
  readonly surfaceTriangleCount: number;
  readonly shorelineTriangleCount: number;
  readonly wallSegmentCount: number;
  readonly estimatedGeometryBytes: number;
  readonly geometrySha256: string;
}

export interface TerrainCellScreenPoint {
  readonly x: number;
  readonly y: number;
}

interface GameCanvasLayout {
  readonly canvasX: number;
  readonly canvasY: number;
  readonly width: number;
  readonly height: number;
  readonly insets: ViewportInsets;
  readonly viewportLeft: number;
  readonly viewportTop: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

export async function readEvidence(page: Page): Promise<InteractionEvidence> {
  return page.evaluate(() => {
    const evidence = window.__WEB_THREE_CITY_INTERACTION__;
    if (evidence === undefined) throw new Error('missing interaction evidence');
    return evidence;
  });
}

export async function readTerrainLabWaterEvidence(page: Page): Promise<TerrainLabWaterEvidence> {
  return page.evaluate(() => {
    const evidence = window.__WEB_THREE_CITY_WATER_EVIDENCE__;
    if (evidence === undefined) throw new Error('missing Terrain Lab Water evidence');
    return evidence;
  });
}

function updateHash(
  hash: ReturnType<typeof createHash>,
  array: Float32Array | Uint16Array,
): number {
  hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
  return array.byteLength;
}

export function createDeterministicWaterGeometryEvidence(): DeterministicWaterGeometryEvidence {
  const waterResult = deriveWaterSnapshot(GAME_TERRAIN, WORLD_CONFIG);
  if (!waterResult.ok) throw new Error(`water-evidence:derivation:${waterResult.error.code}`);

  const build = createCoreWaterPresentationSource(WORLD_CONFIG).buildAll(
    GAME_TERRAIN,
    waterResult.value,
  );
  const hash = createHash('sha256');
  let surfaceTriangleCount = 0;
  let shorelineTriangleCount = 0;
  let estimatedGeometryBytes = 0;

  for (const chunk of build.chunks) {
    for (const array of [
      chunk.surfacePositions,
      chunk.surfaceNormals,
      chunk.surfaceColors,
      chunk.surfaceIndices,
      chunk.shorelinePositions,
      chunk.shorelineColors,
      chunk.shorelineIndices,
    ]) {
      estimatedGeometryBytes += updateHash(hash, array);
    }
    surfaceTriangleCount += chunk.surfaceTriangleCount;
    shorelineTriangleCount += chunk.shorelineTriangleCount;
  }
  for (const array of [
    build.wall.positions,
    build.wall.normals,
    build.wall.colors,
    build.wall.indices,
  ]) {
    estimatedGeometryBytes += updateHash(hash, array);
  }

  return Object.freeze({
    seaTriangleCount: waterResult.value.seaTriangleCount,
    enclosedWetTriangleCount: waterResult.value.enclosedWetTriangleCount,
    shorelineSegmentCount: waterResult.value.shorelineSegmentCount,
    surfaceTriangleCount,
    shorelineTriangleCount,
    wallSegmentCount: build.wall.segmentCount,
    estimatedGeometryBytes,
    geometrySha256: hash.digest('hex'),
  });
}

async function readGameCanvasLayout(page: Page): Promise<GameCanvasLayout> {
  const canvasBounds = await page.locator('#game-canvas').boundingBox();
  if (canvasBounds === null) throw new Error('missing Game canvas bounds');
  const panelBounds = await page.locator('.game-hud').boundingBox();
  const mode = (await page.getByTestId('controls-mode').textContent())?.trim();
  const width = Math.max(1, canvasBounds.width);
  const height = Math.max(1, canvasBounds.height);

  const insets: ViewportInsets =
    panelBounds === null
      ? Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 })
      : mode === 'compact'
        ? Object.freeze({
            top: Math.min(
              height - 1,
              Math.max(0, panelBounds.y + panelBounds.height - canvasBounds.y + 8),
            ),
            right: 0,
            bottom: 0,
            left: 0,
          })
        : Object.freeze({
            top: 0,
            right: 0,
            bottom: 0,
            left: Math.min(
              width - 1,
              Math.max(0, panelBounds.x + panelBounds.width - canvasBounds.x + 16),
            ),
          });

  return Object.freeze({
    canvasX: canvasBounds.x,
    canvasY: canvasBounds.y,
    width,
    height,
    insets,
    viewportLeft: insets.left,
    viewportTop: insets.top,
    viewportWidth: width - insets.left - insets.right,
    viewportHeight: height - insets.top - insets.bottom,
  });
}

function latticeLevel(terrain: TerrainSnapshot, x: number, z: number): number {
  return terrain.heightLevels[z * (terrain.width + 1) + x]!;
}

function terrainCellTriangleCentroids(
  terrain: TerrainSnapshot,
  cell: Readonly<{ x: number; z: number }>,
): readonly THREE.Vector3[] {
  if (
    !Number.isInteger(cell.x) ||
    !Number.isInteger(cell.z) ||
    cell.x < 0 ||
    cell.z < 0 ||
    cell.x >= terrain.width ||
    cell.z >= terrain.height
  ) {
    throw new RangeError(`terrain-cell:invalid-target:${cell.x}:${cell.z}`);
  }

  const corners = Object.freeze({
    nw: latticeLevel(terrain, cell.x, cell.z),
    ne: latticeLevel(terrain, cell.x + 1, cell.z),
    sw: latticeLevel(terrain, cell.x, cell.z + 1),
    se: latticeLevel(terrain, cell.x + 1, cell.z + 1),
  });
  const triangles = CELL_TRIANGLES[selectTerrainDiagonal(corners)];

  return Object.freeze(
    triangles.map((triangle) => {
      const centroid = new THREE.Vector3();
      for (const corner of triangle) {
        const offset = CORNER_OFFSETS[corner];
        centroid.add(
          new THREE.Vector3(
            (cell.x + offset.x - terrain.width / 2) * WORLD_CONFIG.cellSize,
            corners[corner] * WORLD_CONFIG.heightStep,
            (cell.z + offset.z - terrain.height / 2) * WORLD_CONFIG.cellSize,
          ),
        );
      }
      return centroid.multiplyScalar(1 / 3);
    }),
  );
}

function projectWorldPoint(
  point: THREE.Vector3,
  cameraState: CameraState,
  layout: GameCanvasLayout,
): TerrainCellScreenPoint {
  const camera = new THREE.OrthographicCamera();
  const rig = new OrthographicCameraRig(camera, WORLD_CONFIG);
  rig.setViewport(layout.width, layout.height, layout.insets);
  rig.setYawDegrees(cameraState.yawDegrees);
  rig.setPitchDegrees(cameraState.pitchDegrees);
  rig.focus(cameraState.targetX, cameraState.targetZ);
  rig.setOrthographicSize(cameraState.orthographicSize);

  const projected = point.clone().project(camera);
  const x = layout.canvasX + layout.viewportLeft + ((projected.x + 1) / 2) * layout.viewportWidth;
  const y =
    layout.canvasY + layout.viewportTop + (1 - (projected.y + 1) / 2) * layout.viewportHeight;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error('terrain-cell:non-finite-projection');
  }
  return Object.freeze({ x, y });
}

export async function clickTerrainCell(
  page: Page,
  target: Readonly<{ x: number; z: number }>,
): Promise<TerrainCellScreenPoint> {
  const layout = await readGameCanvasLayout(page);
  const cameraState = (await readEvidence(page)).camera;
  let lastSelected: Readonly<{ x: number; z: number }> | null = null;

  for (const centroid of terrainCellTriangleCentroids(GAME_TERRAIN, target)) {
    const screen = projectWorldPoint(centroid, cameraState, layout);
    const hitsCanvas = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.id === 'game-canvas',
      screen,
    );
    if (!hitsCanvas) continue;

    await page.mouse.click(screen.x, screen.y);
    lastSelected = (await readEvidence(page)).selectedCell;
    if (lastSelected?.x === target.x && lastSelected.z === target.z) return screen;
  }

  throw new Error(
    `terrain-cell:projection-mismatch:expected=${target.x},${target.z}:actual=${lastSelected?.x ?? 'none'},${lastSelected?.z ?? 'none'}`,
  );
}

export async function dispatchTouchOn(
  target: Locator,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  id: number,
  x: number,
  y: number,
): Promise<void> {
  await target.dispatchEvent(type, {
    pointerId: id,
    pointerType: 'touch',
    clientX: x,
    clientY: y,
    isPrimary: id === 1,
    bubbles: true,
    cancelable: true,
  });
}

export async function dispatchCanvasTouch(
  page: Page,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  id: number,
  x: number,
  y: number,
): Promise<void> {
  await dispatchTouchOn(page.locator('#game-canvas'), type, id, x, y);
}
