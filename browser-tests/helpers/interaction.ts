import { createHash } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { generateCoastalTerrain } from '../../packages/terrain-generator/src/index.js';
import { deriveWaterSnapshot } from '../../packages/water-core/src/index.js';
import { createCoreWaterPresentationSource } from '../../packages/water-three/src/index.js';
import { WORLD_CONFIG } from '../../packages/world-core/src/index.js';
import type { InteractionEvidence } from '../../apps/game/src/interaction-evidence.js';

export const GAME_URL = 'http://127.0.0.1:4174/';
export const TERRAIN_LAB_URL = 'http://127.0.0.1:4173/';

const GAME_SEED = 1_464_156_977;
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

interface UsableCanvasBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
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
  const terrainResult = generateCoastalTerrain({ seed: GAME_SEED, config: WORLD_CONFIG });
  if (!terrainResult.ok) throw new Error(`water-evidence:generation:${terrainResult.error.code}`);
  const waterResult = deriveWaterSnapshot(terrainResult.value, WORLD_CONFIG);
  if (!waterResult.ok) throw new Error(`water-evidence:derivation:${waterResult.error.code}`);

  const build = createCoreWaterPresentationSource(WORLD_CONFIG).buildAll(
    terrainResult.value,
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

async function usableCanvasBounds(page: Page): Promise<UsableCanvasBounds> {
  const canvasBounds = await page.locator('#game-canvas').boundingBox();
  if (canvasBounds === null) throw new Error('missing Game canvas bounds');
  const panelBounds = await page.locator('.game-hud').boundingBox();
  const mode = (await page.getByTestId('controls-mode').textContent())?.trim();

  let left = canvasBounds.x + 2;
  let top = canvasBounds.y + 2;
  const right = canvasBounds.x + canvasBounds.width - 2;
  const bottom = canvasBounds.y + canvasBounds.height - 2;

  if (panelBounds !== null && mode === 'expanded') {
    left = Math.max(left, panelBounds.x + panelBounds.width + 18);
  } else if (panelBounds !== null && mode === 'compact') {
    top = Math.max(top, panelBounds.y + panelBounds.height + 10);
  }

  if (left >= right || top >= bottom) throw new Error('terrain-cell:no-usable-canvas-region');
  return Object.freeze({ left, top, right, bottom });
}

export async function clickTerrainCell(
  page: Page,
  target: Readonly<{ x: number; z: number }>,
): Promise<TerrainCellScreenPoint> {
  const usable = await usableCanvasBounds(page);

  interface SelectionSample {
    readonly screenX: number;
    readonly screenY: number;
    readonly cell: Readonly<{ x: number; z: number }>;
  }

  const clampX = (x: number): number => Math.min(usable.right, Math.max(usable.left, x));
  const clampY = (y: number): number => Math.min(usable.bottom, Math.max(usable.top, y));
  const selectNear = async (requestedX: number, requestedY: number): Promise<SelectionSample> => {
    const offsets: readonly Readonly<{ x: number; y: number }>[] = [
      { x: 0, y: 0 },
      ...[8, 16, 24, 32, 48, 64].flatMap((radius) => [
        { x: radius, y: 0 },
        { x: -radius, y: 0 },
        { x: 0, y: radius },
        { x: 0, y: -radius },
        { x: radius, y: radius },
        { x: radius, y: -radius },
        { x: -radius, y: radius },
        { x: -radius, y: -radius },
      ]),
    ];

    for (const offset of offsets) {
      const screenX = clampX(requestedX + offset.x);
      const screenY = clampY(requestedY + offset.y);
      const hitsCanvas = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.id === 'game-canvas',
        { x: screenX, y: screenY },
      );
      if (!hitsCanvas) continue;
      await page.mouse.click(screenX, screenY);
      const cell = (await readEvidence(page)).selectedCell;
      if (cell !== null) return { screenX, screenY, cell };
    }
    throw new Error(`terrain-cell:not-selected-near:${requestedX}:${requestedY}`);
  };

  const sampleDirections = [
    { x: 96, y: 0 },
    { x: -96, y: 0 },
    { x: 0, y: -96 },
    { x: 0, y: 96 },
    { x: 72, y: -72 },
    { x: -72, y: -72 },
  ] as const;

  let screenX = usable.left + (usable.right - usable.left) * 0.55;
  let screenY = usable.top + (usable.bottom - usable.top) * 0.58;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await selectNear(screenX, screenY);
    if (current.cell.x === target.x && current.cell.z === target.z) {
      return { x: current.screenX, y: current.screenY };
    }

    const candidates: SelectionSample[] = [];
    for (const direction of sampleDirections) {
      const sample = await selectNear(current.screenX + direction.x, current.screenY + direction.y);
      if (sample.cell.x !== current.cell.x || sample.cell.z !== current.cell.z) {
        candidates.push(sample);
      }
    }

    let correction: Readonly<{ x: number; y: number }> | null = null;
    for (
      let firstIndex = 0;
      firstIndex < candidates.length && correction === null;
      firstIndex += 1
    ) {
      const first = candidates[firstIndex]!;
      const firstCellX = first.cell.x - current.cell.x;
      const firstCellZ = first.cell.z - current.cell.z;
      for (let secondIndex = firstIndex + 1; secondIndex < candidates.length; secondIndex += 1) {
        const second = candidates[secondIndex]!;
        const secondCellX = second.cell.x - current.cell.x;
        const secondCellZ = second.cell.z - current.cell.z;
        const determinant = firstCellX * secondCellZ - secondCellX * firstCellZ;
        if (Math.abs(determinant) < 1e-9) continue;

        const targetCellX = target.x - current.cell.x;
        const targetCellZ = target.z - current.cell.z;
        const firstWeight = (targetCellX * secondCellZ - secondCellX * targetCellZ) / determinant;
        const secondWeight = (firstCellX * targetCellZ - targetCellX * firstCellZ) / determinant;
        correction = {
          x:
            firstWeight * (first.screenX - current.screenX) +
            secondWeight * (second.screenX - current.screenX),
          y:
            firstWeight * (first.screenY - current.screenY) +
            secondWeight * (second.screenY - current.screenY),
        };
        break;
      }
    }
    if (correction === null) throw new Error('terrain-cell:singular-screen-map');

    screenX = clampX(current.screenX + correction.x);
    screenY = clampY(current.screenY + correction.y);
  }

  const selected = await selectNear(screenX, screenY);
  if (selected.cell.x !== target.x || selected.cell.z !== target.z) {
    throw new Error(
      `terrain-cell:projection-mismatch:expected=${target.x},${target.z}:actual=${selected.cell.x},${selected.cell.z}`,
    );
  }
  return { x: selected.screenX, y: selected.screenY };
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
