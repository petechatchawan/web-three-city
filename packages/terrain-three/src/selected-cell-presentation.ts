import {
  CELL_TRIANGLES,
  selectTerrainDiagonal,
  type TerrainCorner,
  type TerrainSnapshot,
} from '@web-three-city/terrain-core';
import { vertexToWorld, type CellCoord, type WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';

const SELECTION_OFFSET = 0.02;
const CORNER_ORDER = ['nw', 'ne', 'sw', 'se'] as const satisfies readonly TerrainCorner[];
const CORNER_INDEX: Readonly<Record<TerrainCorner, number>> = Object.freeze({
  nw: 0,
  ne: 1,
  sw: 2,
  se: 3,
});

export type SelectionPresentationErrorCode =
  | 'selection:invalid-cell'
  | 'selection:invalid-snapshot'
  | 'selection:not-loaded'
  | 'selection:disposed';

export class SelectionPresentationError extends Error {
  readonly code: SelectionPresentationErrorCode;

  constructor(code: SelectionPresentationErrorCode, message: string) {
    super(message);
    this.name = 'SelectionPresentationError';
    this.code = code;
  }
}

export interface SelectedCellOverlayData {
  readonly cell: CellCoord;
  readonly terrainRevision: number;
  readonly positions: Float32Array;
  readonly indices: Uint16Array;
  readonly borderPositions: Float32Array;
}

function assertSnapshot(snapshot: TerrainSnapshot, config: WorldConfig): void {
  if (
    snapshot.width !== config.mapWidth ||
    snapshot.height !== config.mapHeight ||
    snapshot.heightLevels.length !== (config.mapWidth + 1) * (config.mapHeight + 1)
  ) {
    throw new SelectionPresentationError(
      'selection:invalid-snapshot',
      'Terrain snapshot dimensions do not match the world configuration.',
    );
  }
}

function assertCell(cell: CellCoord, config: WorldConfig): void {
  if (
    !Number.isInteger(cell.x) ||
    !Number.isInteger(cell.z) ||
    cell.x < 0 ||
    cell.z < 0 ||
    cell.x >= config.mapWidth ||
    cell.z >= config.mapHeight
  ) {
    throw new SelectionPresentationError(
      'selection:invalid-cell',
      'Selected Terrain cell is outside the authoritative map.',
    );
  }
}

function heightAt(snapshot: TerrainSnapshot, x: number, z: number): number {
  return snapshot.heightLevels[z * (snapshot.width + 1) + x]!;
}

export function buildSelectedCellOverlayData(
  snapshot: TerrainSnapshot,
  cell: CellCoord,
  config: WorldConfig,
): SelectedCellOverlayData {
  assertSnapshot(snapshot, config);
  assertCell(cell, config);

  const vertexCoords = {
    nw: { x: cell.x, z: cell.z },
    ne: { x: cell.x + 1, z: cell.z },
    sw: { x: cell.x, z: cell.z + 1 },
    se: { x: cell.x + 1, z: cell.z + 1 },
  } as const;
  const corners = {
    nw: heightAt(snapshot, vertexCoords.nw.x, vertexCoords.nw.z),
    ne: heightAt(snapshot, vertexCoords.ne.x, vertexCoords.ne.z),
    sw: heightAt(snapshot, vertexCoords.sw.x, vertexCoords.sw.z),
    se: heightAt(snapshot, vertexCoords.se.x, vertexCoords.se.z),
  };
  const worldByCorner = Object.fromEntries(
    CORNER_ORDER.map((corner) => {
      const coord = vertexCoords[corner];
      const world = vertexToWorld(coord, corners[corner], config);
      return [corner, { x: world.x, y: world.y + SELECTION_OFFSET, z: world.z }];
    }),
  ) as Record<TerrainCorner, Readonly<{ x: number; y: number; z: number }>>;
  const positions = new Float32Array(
    CORNER_ORDER.flatMap((corner) => {
      const point = worldByCorner[corner];
      return [point.x, point.y, point.z];
    }),
  );
  const diagonal = selectTerrainDiagonal(corners);
  const indices = new Uint16Array(
    CELL_TRIANGLES[diagonal].flatMap((triangle) => triangle.map((corner) => CORNER_INDEX[corner])),
  );
  const borderOrder = ['nw', 'ne', 'se', 'sw', 'nw'] as const;
  const borderPositions = new Float32Array(
    borderOrder.flatMap((corner) => {
      const point = worldByCorner[corner];
      return [point.x, point.y, point.z];
    }),
  );

  return Object.freeze({
    cell: Object.freeze({ ...cell }),
    terrainRevision: snapshot.revision,
    positions,
    indices,
    borderPositions,
  });
}

function createFillGeometry(data: SelectedCellOverlayData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function createBorderGeometry(data: SelectedCellOverlayData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.borderPositions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function disposeRoot(root: THREE.Group): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.geometry.dispose();
  });
}

export class SelectedCellPresentation {
  readonly #scene: THREE.Scene;
  readonly #config: WorldConfig;
  readonly #fillMaterial = new THREE.MeshBasicMaterial({
    color: 0x5ed6a0,
    transparent: true,
    opacity: 0.32,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  readonly #borderMaterial = new THREE.LineBasicMaterial({
    color: 0x164d3d,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
    depthWrite: false,
  });
  #root: THREE.Group | null = null;
  #cell: CellCoord | null = null;
  #terrainRevision: number | null = null;
  #visible = false;
  #disposed = false;

  constructor(scene: THREE.Scene, config: WorldConfig) {
    this.#scene = scene;
    this.#config = config;
  }

  get object3d(): THREE.Group {
    this.#assertUsable();
    if (this.#root === null) {
      throw new SelectionPresentationError('selection:not-loaded', 'Selection is not loaded.');
    }
    return this.#root;
  }

  get visible(): boolean {
    return this.#visible;
  }

  get selectedCell(): CellCoord | null {
    return this.#cell === null ? null : { ...this.#cell };
  }

  setSelection(snapshot: TerrainSnapshot, cell: CellCoord): void {
    this.#assertUsable();
    if (
      this.#root !== null &&
      this.#cell?.x === cell.x &&
      this.#cell.z === cell.z &&
      this.#terrainRevision === snapshot.revision
    ) {
      this.#visible = true;
      this.#root.visible = true;
      return;
    }

    const data = buildSelectedCellOverlayData(snapshot, cell, this.#config);
    const stagedRoot = new THREE.Group();
    stagedRoot.name = 'selected-cell-presentation-root';
    const fill = new THREE.Mesh(createFillGeometry(data), this.#fillMaterial);
    fill.name = 'selected-cell-fill';
    fill.renderOrder = 20;
    const border = new THREE.Line(createBorderGeometry(data), this.#borderMaterial);
    border.name = 'selected-cell-border';
    border.renderOrder = 21;
    stagedRoot.add(fill, border);

    const previousRoot = this.#root;
    this.#scene.add(stagedRoot);
    this.#root = stagedRoot;
    this.#cell = { ...cell };
    this.#terrainRevision = snapshot.revision;
    this.#visible = true;

    if (previousRoot !== null) {
      this.#scene.remove(previousRoot);
      disposeRoot(previousRoot);
      previousRoot.clear();
    }
  }

  clear(): void {
    this.#assertUsable();
    this.#cell = null;
    this.#terrainRevision = null;
    this.#visible = false;
    if (this.#root !== null) this.#root.visible = false;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#root !== null) {
      this.#scene.remove(this.#root);
      disposeRoot(this.#root);
      this.#root.clear();
      this.#root = null;
    }
    this.#fillMaterial.dispose();
    this.#borderMaterial.dispose();
    this.#cell = null;
    this.#terrainRevision = null;
    this.#visible = false;
  }

  #assertUsable(): void {
    if (this.#disposed) {
      throw new SelectionPresentationError(
        'selection:disposed',
        'Selection presentation is disposed.',
      );
    }
  }
}
