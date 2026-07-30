import {
  vertexIndex,
  type CellCoord,
  type GridVertexCoord,
  type WorldConfig,
} from '@web-three-city/world-core';
import { classifyTerrainShape } from './shape-classifier.js';
import type { TerrainSnapshot } from './terrain-map.js';
import type {
  TerraformInvalidReason,
  TerraformOperation,
  TerraformStrokeInput,
} from './terraform-contracts.js';
import type { TerrainCorners } from './topology.js';

const MAX_SUPPORT_RING = 4;
const MAX_SUPPORT_VERTICES = 256;
const FORBIDDEN_SHAPES = new Set([
  'diagonal-ridge',
  'diagonal-valley',
  'saddle-or-twist',
  'severe-delta',
]);

export interface TerraformSupportResult {
  readonly proposedHeightLevels: Uint8Array;
  readonly coreVertices: readonly GridVertexCoord[];
  readonly supportVertices: readonly GridVertexCoord[];
  readonly affectedVertices: readonly GridVertexCoord[];
  readonly supportCells: readonly CellCoord[];
  readonly valid: boolean;
  readonly invalidReason: TerraformInvalidReason | null;
}

function coordinateKey(coord: Readonly<{ x: number; z: number }>): string {
  return `${coord.x}:${coord.z}`;
}

function coordinateOrder(
  first: Readonly<{ x: number; z: number }>,
  second: Readonly<{ x: number; z: number }>,
): number {
  return first.z - second.z || first.x - second.x;
}

function frozenCoordinates<T extends Readonly<{ x: number; z: number }>>(
  values: Iterable<T>,
): readonly T[] {
  return Object.freeze(
    [...values]
      .map((value) => Object.freeze({ x: value.x, z: value.z }) as T)
      .sort(coordinateOrder),
  );
}

function validCell(cell: CellCoord, config: WorldConfig): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.z) &&
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < config.mapWidth &&
    cell.z < config.mapHeight
  );
}

function validVertex(vertex: GridVertexCoord, config: WorldConfig): boolean {
  return (
    Number.isInteger(vertex.x) &&
    Number.isInteger(vertex.z) &&
    vertex.x >= 0 &&
    vertex.z >= 0 &&
    vertex.x <= config.mapWidth &&
    vertex.z <= config.mapHeight
  );
}

function verticesForCell(cell: CellCoord): readonly GridVertexCoord[] {
  return [
    { x: cell.x, z: cell.z },
    { x: cell.x + 1, z: cell.z },
    { x: cell.x, z: cell.z + 1 },
    { x: cell.x + 1, z: cell.z + 1 },
  ];
}

function incidentCells(vertex: GridVertexCoord, config: WorldConfig): readonly CellCoord[] {
  return [
    { x: vertex.x - 1, z: vertex.z - 1 },
    { x: vertex.x, z: vertex.z - 1 },
    { x: vertex.x - 1, z: vertex.z },
    { x: vertex.x, z: vertex.z },
  ].filter((cell) => validCell(cell, config));
}

function oneStepLevel(base: number, operation: TerraformOperation, target?: number): number {
  if (operation === 'raise') return base + 1;
  if (operation === 'lower') return base - 1;
  if (target === undefined) return Number.NaN;
  return base === target ? base : base + Math.sign(target - base);
}

function minimumChebyshev(
  vertex: GridVertexCoord,
  coreVertices: readonly GridVertexCoord[],
): number {
  let result = Number.POSITIVE_INFINITY;
  for (const core of coreVertices) {
    result = Math.min(
      result,
      Math.max(Math.abs(vertex.x - core.x), Math.abs(vertex.z - core.z)),
    );
  }
  return result;
}

function cornersAt(
  levels: Uint8Array,
  cell: CellCoord,
  config: WorldConfig,
): TerrainCorners {
  return {
    nw: levels[vertexIndex({ x: cell.x, z: cell.z }, config)]!,
    ne: levels[vertexIndex({ x: cell.x + 1, z: cell.z }, config)]!,
    sw: levels[vertexIndex({ x: cell.x, z: cell.z + 1 }, config)]!,
    se: levels[vertexIndex({ x: cell.x + 1, z: cell.z + 1 }, config)]!,
  };
}

function canonical(levels: Uint8Array, cell: CellCoord, config: WorldConfig): boolean {
  return !FORBIDDEN_SHAPES.has(classifyTerrainShape(cornersAt(levels, cell, config)));
}

function cellsWithHalo(cells: Iterable<CellCoord>, config: WorldConfig): readonly CellCoord[] {
  const result = new Map<string, CellCoord>();
  for (const cell of cells) {
    for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const candidate = { x: cell.x + offsetX, z: cell.z + offsetZ };
        if (validCell(candidate, config)) result.set(coordinateKey(candidate), candidate);
      }
    }
  }
  return frozenCoordinates(result.values());
}

function candidateCombinations(
  candidates: readonly GridVertexCoord[],
  coreVertices: readonly GridVertexCoord[],
): readonly (readonly GridVertexCoord[])[] {
  const combinations: GridVertexCoord[][] = [];
  for (let mask = 1; mask < 1 << candidates.length; mask += 1) {
    const combination: GridVertexCoord[] = [];
    for (let index = 0; index < candidates.length; index += 1) {
      if ((mask & (1 << index)) !== 0) combination.push(candidates[index]!);
    }
    combinations.push(combination);
  }
  combinations.sort(
    (first, second) =>
      first.length - second.length ||
      first.reduce((sum, vertex) => sum + minimumChebyshev(vertex, coreVertices), 0) -
        second.reduce((sum, vertex) => sum + minimumChebyshev(vertex, coreVertices), 0) ||
      first.map(coordinateKey).join('|').localeCompare(second.map(coordinateKey).join('|')),
  );
  return combinations;
}

export function propagateTerraformSupport(
  terrain: TerrainSnapshot,
  input: TerraformStrokeInput,
  coreCells: readonly CellCoord[],
  config: WorldConfig,
): TerraformSupportResult {
  const proposedHeightLevels = terrain.heightLevels.slice();
  if (coreCells.some((cell) => !validCell(cell, config))) {
    return Object.freeze({
      proposedHeightLevels,
      coreVertices: Object.freeze([]),
      supportVertices: Object.freeze([]),
      affectedVertices: Object.freeze([]),
      supportCells: Object.freeze([]),
      valid: false,
      invalidReason: 'terraform:invalid-cell',
    });
  }

  const coreByKey = new Map<string, GridVertexCoord>();
  for (const cell of coreCells) {
    for (const vertex of verticesForCell(cell)) coreByKey.set(coordinateKey(vertex), vertex);
  }

  const coreVertices = frozenCoordinates(coreByKey.values());
  const supportByKey = new Map<string, GridVertexCoord>();
  const changedByKey = new Map<string, GridVertexCoord>();
  const queue: GridVertexCoord[] = [];
  const queuedKeys = new Set<string>();

  const enqueue = (vertex: GridVertexCoord): void => {
    const key = coordinateKey(vertex);
    if (queuedKeys.has(key)) return;
    queue.push(vertex);
    queuedKeys.add(key);
  };

  const addSupport = (vertex: GridVertexCoord): boolean => {
    const key = coordinateKey(vertex);
    if (
      coreByKey.has(key) ||
      changedByKey.has(key) ||
      minimumChebyshev(vertex, coreVertices) > MAX_SUPPORT_RING ||
      supportByKey.size >= MAX_SUPPORT_VERTICES
    ) {
      return false;
    }

    const index = vertexIndex(vertex, config);
    const next = oneStepLevel(
      terrain.heightLevels[index]!,
      input.operation,
      input.flattenTargetLevel,
    );
    if (
      !Number.isInteger(next) ||
      next < config.minHeightLevel ||
      next > config.maxHeightLevel ||
      next === terrain.heightLevels[index]
    ) {
      return false;
    }

    proposedHeightLevels[index] = next;
    supportByKey.set(key, vertex);
    changedByKey.set(key, vertex);
    enqueue(vertex);
    return true;
  };

  for (const vertex of coreVertices) {
    const index = vertexIndex(vertex, config);
    const next = oneStepLevel(
      terrain.heightLevels[index]!,
      input.operation,
      input.flattenTargetLevel,
    );
    if (!Number.isInteger(next) || next < config.minHeightLevel || next > config.maxHeightLevel) {
      return finish(false, 'terraform:height-range');
    }
    proposedHeightLevels[index] = next;
    if (next !== terrain.heightLevels[index]) {
      changedByKey.set(coordinateKey(vertex), vertex);
      enqueue(vertex);
    }
  }

  if (changedByKey.size === 0) return finish(false, 'terraform:no-change');

  const processCardinalDeltas = (): TerraformInvalidReason | null => {
    while (queue.length > 0) {
      queue.sort(coordinateOrder);
      const currentVertex = queue.shift()!;
      queuedKeys.delete(coordinateKey(currentVertex));
      const currentLevel = proposedHeightLevels[vertexIndex(currentVertex, config)]!;

      for (const neighbor of [
        { x: currentVertex.x, z: currentVertex.z - 1 },
        { x: currentVertex.x + 1, z: currentVertex.z },
        { x: currentVertex.x, z: currentVertex.z + 1 },
        { x: currentVertex.x - 1, z: currentVertex.z },
      ]) {
        if (!validVertex(neighbor, config)) continue;
        const neighborIndex = vertexIndex(neighbor, config);
        const neighborLevel = proposedHeightLevels[neighborIndex]!;
        if (Math.abs(currentLevel - neighborLevel) <= 1) continue;

        const neighborKey = coordinateKey(neighbor);
        if (coreByKey.has(neighborKey) || changedByKey.has(neighborKey)) {
          return 'terraform:propagation-blocked';
        }

        const next = oneStepLevel(
          terrain.heightLevels[neighborIndex]!,
          input.operation,
          input.flattenTargetLevel,
        );
        if (!Number.isInteger(next) || next < config.minHeightLevel || next > config.maxHeightLevel) {
          return 'terraform:height-range';
        }
        if (Math.abs(currentLevel - next) >= Math.abs(currentLevel - neighborLevel)) {
          return 'terraform:propagation-blocked';
        }
        if (
          minimumChebyshev(neighbor, coreVertices) > MAX_SUPPORT_RING ||
          supportByKey.size >= MAX_SUPPORT_VERTICES
        ) {
          return 'terraform:propagation-limit';
        }

        proposedHeightLevels[neighborIndex] = next;
        supportByKey.set(neighborKey, neighbor);
        changedByKey.set(neighborKey, neighbor);
        enqueue(neighbor);
      }
    }
    return null;
  };

  for (;;) {
    const cardinalError = processCardinalDeltas();
    if (cardinalError !== null) return finish(false, cardinalError);

    const invalidCell = cellsWithHalo(currentAffectedCells(), config).find(
      (cell) => !canonical(proposedHeightLevels, cell, config),
    );
    if (invalidCell === undefined) break;

    const candidates = verticesForCell(invalidCell)
      .filter(
        (vertex) =>
          !coreByKey.has(coordinateKey(vertex)) &&
          !changedByKey.has(coordinateKey(vertex)) &&
          validVertex(vertex, config),
      )
      .sort(coordinateOrder);

    let selected: readonly GridVertexCoord[] | null = null;
    for (const combination of candidateCombinations(candidates, coreVertices)) {
      if (
        supportByKey.size + combination.length > MAX_SUPPORT_VERTICES ||
        combination.some((vertex) => minimumChebyshev(vertex, coreVertices) > MAX_SUPPORT_RING)
      ) {
        continue;
      }

      const savedLevels = combination.map(
        (vertex) => proposedHeightLevels[vertexIndex(vertex, config)]!,
      );
      let possible = true;
      for (const [index, vertex] of combination.entries()) {
        const levelIndex = vertexIndex(vertex, config);
        const next = oneStepLevel(
          terrain.heightLevels[levelIndex]!,
          input.operation,
          input.flattenTargetLevel,
        );
        if (
          !Number.isInteger(next) ||
          next < config.minHeightLevel ||
          next > config.maxHeightLevel ||
          next === savedLevels[index]
        ) {
          possible = false;
          break;
        }
        proposedHeightLevels[levelIndex] = next;
      }

      const becomesCanonical = possible && canonical(proposedHeightLevels, invalidCell, config);
      for (const [index, vertex] of combination.entries()) {
        proposedHeightLevels[vertexIndex(vertex, config)] = savedLevels[index]!;
      }
      if (becomesCanonical) {
        selected = combination;
        break;
      }
    }

    if (selected === null) return finish(false, 'terraform:non-canonical-shape');
    for (const vertex of selected) {
      if (addSupport(vertex)) continue;
      return finish(
        false,
        minimumChebyshev(vertex, coreVertices) > MAX_SUPPORT_RING ||
          supportByKey.size >= MAX_SUPPORT_VERTICES
          ? 'terraform:propagation-limit'
          : 'terraform:propagation-blocked',
      );
    }
  }

  return finish(true, null);

  function currentSupportCells(): readonly CellCoord[] {
    const result = new Map<string, CellCoord>();
    for (const vertex of supportByKey.values()) {
      for (const cell of incidentCells(vertex, config)) {
        if (coreCells.some((core) => core.x === cell.x && core.z === cell.z)) continue;
        result.set(coordinateKey(cell), cell);
      }
    }
    return frozenCoordinates(result.values());
  }

  function currentAffectedCells(): readonly CellCoord[] {
    const result = new Map<string, CellCoord>();
    for (const cell of [...coreCells, ...currentSupportCells()]) {
      result.set(coordinateKey(cell), cell);
    }
    return frozenCoordinates(result.values());
  }

  function finish(
    valid: boolean,
    invalidReason: TerraformInvalidReason | null,
  ): TerraformSupportResult {
    return Object.freeze({
      proposedHeightLevels,
      coreVertices,
      supportVertices: frozenCoordinates(supportByKey.values()),
      affectedVertices: frozenCoordinates([...coreVertices, ...supportByKey.values()]),
      supportCells: currentSupportCells(),
      valid,
      invalidReason,
    });
  }
}
