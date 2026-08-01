import { chunkForCell, type ChunkCoord } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import {
  BASIC_ROAD_CODE,
  EMPTY_ROAD_CODE,
  RoadContractError,
  roadDefinitionForId,
  type RoadInvalidReason,
  type RoadMutationPlan,
  type RoadMutationReceipt,
  type RoadPlacementEnvironment,
  type RoadSnapshot,
  type RoadStrokeInput,
} from './contracts.js';
import {
  assertCoherentRoadEnvironment,
  roadCellPolicyInvalidReason,
  roadConnectionMaskAt,
} from './connectivity.js';
import { createRoadSnapshot, roadDefinitionCodeAt } from './road-snapshot.js';

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

function cellKey(cell: CellCoord, config: WorldConfig): number {
  return cell.z * config.mapWidth + cell.x;
}

function frozenCell(cell: CellCoord): CellCoord {
  return Object.freeze({ x: cell.x, z: cell.z });
}

function sortCells(cells: Iterable<CellCoord>): readonly CellCoord[] {
  return Object.freeze(
    [...cells].map(frozenCell).sort((first, second) => first.z - second.z || first.x - second.x),
  );
}

function normalizeCells(
  cells: readonly CellCoord[],
  config: WorldConfig,
): { readonly valid: boolean; readonly cells: readonly CellCoord[] } {
  const normalized = new Map<number, CellCoord>();
  for (const cell of cells) {
    if (!validCell(cell, config)) return { valid: false, cells: Object.freeze([]) };
    normalized.set(cellKey(cell, config), cell);
  }
  return { valid: true, cells: sortCells(normalized.values()) };
}

function affectedCells(changed: readonly CellCoord[], config: WorldConfig): readonly CellCoord[] {
  const affected = new Map<number, CellCoord>();
  for (const cell of changed) {
    for (const candidate of [
      cell,
      { x: cell.x, z: cell.z - 1 },
      { x: cell.x + 1, z: cell.z },
      { x: cell.x, z: cell.z + 1 },
      { x: cell.x - 1, z: cell.z },
    ]) {
      if (validCell(candidate, config)) affected.set(cellKey(candidate, config), candidate);
    }
  }
  return sortCells(affected.values());
}

function sameCells(first: readonly CellCoord[], second: readonly CellCoord[]): boolean {
  return (
    first.length === second.length &&
    first.every((cell, index) => cell.x === second[index]?.x && cell.z === second[index]?.z)
  );
}

function frozenChunks(chunks: Iterable<ChunkCoord>): readonly ChunkCoord[] {
  const unique = new Map<string, ChunkCoord>();
  for (const chunk of chunks) unique.set(`${chunk.x}:${chunk.z}`, chunk);
  return Object.freeze(
    [...unique.values()]
      .map((chunk) => Object.freeze({ x: chunk.x, z: chunk.z }))
      .sort((first, second) => first.z - second.z || first.x - second.x),
  );
}

function deriveMutation(
  roads: RoadSnapshot,
  proposed: RoadSnapshot,
  changedCells: readonly CellCoord[],
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): {
  readonly topologyChangedCells: readonly CellCoord[];
  readonly invalidReason: RoadInvalidReason | null;
} {
  const affected = affectedCells(changedCells, config);
  const topologyChanged: CellCoord[] = [];
  for (const cell of affected) {
    const beforeMask = roadConnectionMaskAt(roads, cell, environment, config);
    const afterMask = roadConnectionMaskAt(proposed, cell, environment, config);
    if (beforeMask !== afterMask) topologyChanged.push(cell);
  }

  for (const cell of affected) {
    const invalidReason = roadCellPolicyInvalidReason(proposed, cell, environment, config);
    if (invalidReason !== null) {
      return {
        topologyChangedCells: sortCells(topologyChanged),
        invalidReason,
      };
    }
  }
  return {
    topologyChangedCells: sortCells(topologyChanged),
    invalidReason: null,
  };
}

function createPlan(input: {
  readonly operation: RoadStrokeInput['operation'];
  readonly roads: RoadSnapshot;
  readonly environment: RoadPlacementEnvironment;
  readonly requestedCells: readonly CellCoord[];
  readonly addedCells: readonly CellCoord[];
  readonly removedCells: readonly CellCoord[];
  readonly topologyChangedCells: readonly CellCoord[];
  readonly proposedDefinitionCodes: Uint8Array;
  readonly dirtyChunks: readonly ChunkCoord[];
  readonly invalidReason: RoadInvalidReason | null;
}): RoadMutationPlan {
  const proposed = input.proposedDefinitionCodes.slice();
  return Object.freeze({
    operation: input.operation,
    baseRoadRevision: input.roads.revision,
    baseTerrainRevision: input.environment.terrainRevision,
    baseWaterSourceTerrainRevision: input.environment.waterSourceTerrainRevision,
    requestedCells: input.requestedCells,
    addedCells: input.addedCells,
    removedCells: input.removedCells,
    topologyChangedCells: input.topologyChangedCells,
    get proposedDefinitionCodes(): Uint8Array {
      return proposed.slice();
    },
    dirtyChunks: input.dirtyChunks,
    valid: input.invalidReason === null,
    invalidReason: input.invalidReason,
  });
}

export function planRoadMutation(
  roads: RoadSnapshot,
  input: RoadStrokeInput,
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): RoadMutationPlan {
  let invalidReason: RoadInvalidReason | null = null;
  try {
    createRoadSnapshot(
      {
        width: roads.width,
        height: roads.height,
        revision: roads.revision,
        definitionCodes: roads.definitionCodes,
      },
      config,
    );
    roadDefinitionForId(input.definitionId);
  } catch {
    invalidReason = 'road:invalid-state';
  }

  if (invalidReason === null) {
    try {
      assertCoherentRoadEnvironment(environment);
    } catch {
      invalidReason = 'road:incoherent-world-revision';
    }
  }

  const normalized = normalizeCells(input.cells, config);
  if (invalidReason === null && !normalized.valid) invalidReason = 'road:invalid-cell';
  const requestedCells = normalized.cells;
  const proposedCodes = roads.definitionCodes;
  const added: CellCoord[] = [];
  const removed: CellCoord[] = [];

  if (invalidReason === null) {
    for (const cell of requestedCells) {
      const index = cellKey(cell, config);
      const before = proposedCodes[index]!;
      if (input.operation === 'build' && before === EMPTY_ROAD_CODE) {
        proposedCodes[index] = BASIC_ROAD_CODE;
        added.push(cell);
      } else if (input.operation === 'bulldoze' && before !== EMPTY_ROAD_CODE) {
        proposedCodes[index] = EMPTY_ROAD_CODE;
        removed.push(cell);
      }
    }
    if (added.length === 0 && removed.length === 0) invalidReason = 'road:no-change';
  }

  const addedCells = sortCells(added);
  const removedCells = sortCells(removed);
  const changedCells = sortCells([...addedCells, ...removedCells]);
  let topologyChangedCells: readonly CellCoord[] = Object.freeze([]);
  if (invalidReason === null) {
    try {
      const proposed = createRoadSnapshot(
        {
          width: roads.width,
          height: roads.height,
          revision: roads.revision,
          definitionCodes: proposedCodes,
        },
        config,
      );
      const derived = deriveMutation(roads, proposed, changedCells, environment, config);
      topologyChangedCells = derived.topologyChangedCells;
      invalidReason = derived.invalidReason;
    } catch {
      invalidReason = 'road:invalid-state';
    }
  }

  const dirtyChunks =
    invalidReason === null
      ? frozenChunks(
          [...changedCells, ...topologyChangedCells].map((cell) => chunkForCell(cell, config)),
        )
      : Object.freeze([]);

  return createPlan({
    operation: input.operation,
    roads,
    environment,
    requestedCells,
    addedCells,
    removedCells,
    topologyChangedCells,
    proposedDefinitionCodes: proposedCodes,
    dirtyChunks,
    invalidReason,
  });
}

export function commitRoadMutation(
  roads: RoadSnapshot,
  plan: RoadMutationPlan,
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): { readonly snapshot: RoadSnapshot; readonly receipt: RoadMutationReceipt } {
  if (!plan.valid || plan.invalidReason !== null) {
    throw new RoadContractError('road:invalid-plan');
  }
  if (roads.revision !== plan.baseRoadRevision) {
    throw new RoadContractError('road:stale-road-plan');
  }
  if (environment.terrainRevision !== plan.baseTerrainRevision) {
    throw new RoadContractError('road:stale-terrain-plan');
  }
  if (environment.waterSourceTerrainRevision !== plan.baseWaterSourceTerrainRevision) {
    throw new RoadContractError('road:stale-water-plan');
  }

  try {
    assertCoherentRoadEnvironment(environment);
    const proposed = createRoadSnapshot(
      {
        width: roads.width,
        height: roads.height,
        revision: roads.revision,
        definitionCodes: plan.proposedDefinitionCodes,
      },
      config,
    );
    const added: CellCoord[] = [];
    const removed: CellCoord[] = [];
    for (let z = 0; z < config.mapHeight; z += 1) {
      for (let x = 0; x < config.mapWidth; x += 1) {
        const cell = { x, z };
        const before = roadDefinitionCodeAt(roads, cell);
        const after = roadDefinitionCodeAt(proposed, cell);
        if (before === EMPTY_ROAD_CODE && after === BASIC_ROAD_CODE) added.push(cell);
        if (before === BASIC_ROAD_CODE && after === EMPTY_ROAD_CODE) removed.push(cell);
      }
    }
    const addedCells = sortCells(added);
    const removedCells = sortCells(removed);
    if (!sameCells(addedCells, plan.addedCells) || !sameCells(removedCells, plan.removedCells)) {
      throw new RoadContractError('road:invalid-proposed-state');
    }

    const changedCells = sortCells([...addedCells, ...removedCells]);
    const derived = deriveMutation(roads, proposed, changedCells, environment, config);
    if (
      derived.invalidReason !== null ||
      !sameCells(derived.topologyChangedCells, plan.topologyChangedCells)
    ) {
      throw new RoadContractError('road:invalid-proposed-state');
    }

    const snapshot = createRoadSnapshot(
      {
        width: roads.width,
        height: roads.height,
        revision: roads.revision + 1,
        definitionCodes: proposed.definitionCodes,
      },
      config,
    );
    const receipt: RoadMutationReceipt = Object.freeze({
      beforeRevision: roads.revision,
      afterRevision: snapshot.revision,
      addedCellCount: addedCells.length,
      removedCellCount: removedCells.length,
      topologyChangedCellCount: derived.topologyChangedCells.length,
      dirtyChunks: frozenChunks(plan.dirtyChunks),
    });
    return Object.freeze({ snapshot, receipt });
  } catch (error) {
    if (error instanceof RoadContractError) throw error;
    throw new RoadContractError('road:invalid-proposed-state');
  }
}
