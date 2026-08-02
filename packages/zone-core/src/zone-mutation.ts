import { chunkForCell, type ChunkCoord } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import {
  EMPTY_ZONE_CODE,
  ZoneContractError,
  type ZoneDefinitionCode,
  type ZoneInvalidCell,
  type ZoneInvalidReason,
  type ZoneMutationPlan,
  type ZoneMutationReceipt,
  type ZonePlacementEnvironment,
  type ZoneSnapshot,
  type ZoneStrokeInput,
} from './contracts.js';
import { zoneDefinitionForId } from './zone-definitions.js';
import { createZoneSnapshot } from './zone-snapshot.js';

const REASON_PRECEDENCE: readonly ZoneInvalidReason[] = Object.freeze([
  'zone:invalid-state',
  'zone:invalid-environment',
  'zone:invalid-cell',
  'zone:unknown-definition',
  'zone:road-occupied',
  'zone:occupied',
  'zone:zone-conflict',
  'zone:wet-cell',
  'zone:unsupported-terrain',
  'zone:road-access-required',
  'zone:no-change',
]);

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

function cellIndex(cell: CellCoord, config: WorldConfig): number {
  return cell.z * config.mapWidth + cell.x;
}

function cellKey(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function frozenCell(cell: CellCoord): CellCoord {
  return Object.freeze({ x: cell.x, z: cell.z });
}

function frozenCells(cells: Iterable<CellCoord>): readonly CellCoord[] {
  return Object.freeze([...cells].map(frozenCell));
}

function frozenInvalidCells(cells: Iterable<ZoneInvalidCell>): readonly ZoneInvalidCell[] {
  return Object.freeze(
    [...cells].map((entry) =>
      Object.freeze({
        cell: frozenCell(entry.cell),
        reason: entry.reason,
      }),
    ),
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

function normalizeCells(
  cells: readonly CellCoord[],
  config: WorldConfig,
): { readonly valid: boolean; readonly cells: readonly CellCoord[] } {
  const unique = new Map<string, CellCoord>();
  for (const cell of cells) {
    if (!validCell(cell, config)) return { valid: false, cells: Object.freeze([]) };
    if (!unique.has(cellKey(cell))) unique.set(cellKey(cell), frozenCell(cell));
  }
  return { valid: true, cells: Object.freeze([...unique.values()]) };
}

function environmentIsValid(environment: ZonePlacementEnvironment): boolean {
  return (
    Number.isSafeInteger(environment.terrainRevision) &&
    environment.terrainRevision >= 0 &&
    Number.isSafeInteger(environment.waterSourceTerrainRevision) &&
    environment.waterSourceTerrainRevision >= 0 &&
    Number.isSafeInteger(environment.roadRevision) &&
    environment.roadRevision >= 0 &&
    Number.isSafeInteger(environment.occupancyRevision) &&
    environment.occupancyRevision >= 0 &&
    environment.waterSourceTerrainRevision === environment.terrainRevision
  );
}

function primaryReason(reasons: readonly ZoneInvalidReason[]): ZoneInvalidReason | null {
  for (const candidate of REASON_PRECEDENCE) {
    if (reasons.includes(candidate)) return candidate;
  }
  return null;
}

function paintInvalidReason(
  zones: ZoneSnapshot,
  proposedCodes: Uint8Array,
  cell: CellCoord,
  selectedCode: ZoneDefinitionCode,
  environment: ZonePlacementEnvironment,
  config: WorldConfig,
): ZoneInvalidReason | 'unchanged' | null {
  const before = proposedCodes[cellIndex(cell, config)] as ZoneDefinitionCode;
  if (before === selectedCode) return 'unchanged';
  if (environment.isRoadOccupied(cell)) return 'zone:road-occupied';
  if (environment.isBlockedByNonZoneOccupancy(cell)) return 'zone:occupied';
  if (before !== EMPTY_ZONE_CODE) return 'zone:zone-conflict';
  if (!environment.isDry(cell)) return 'zone:wet-cell';
  if (environment.surfaceAt(cell).shape !== 'flat') return 'zone:unsupported-terrain';
  if (environment.roadAccessAt(cell) === null) return 'zone:road-access-required';
  void zones;
  return null;
}

function createPlan(input: {
  readonly zones: ZoneSnapshot;
  readonly stroke: ZoneStrokeInput;
  readonly environment: ZonePlacementEnvironment;
  readonly requestedCells: readonly CellCoord[];
  readonly changedCells: readonly CellCoord[];
  readonly unchangedCells: readonly CellCoord[];
  readonly invalidCells: readonly ZoneInvalidCell[];
  readonly proposedDefinitionCodes: Uint8Array;
  readonly dirtyChunks: readonly ChunkCoord[];
  readonly invalidReason: ZoneInvalidReason | null;
}): ZoneMutationPlan {
  const proposed = input.proposedDefinitionCodes.slice();
  return Object.freeze({
    operation: input.stroke.operation,
    definitionId: input.stroke.definitionId,
    baseZoneRevision: input.zones.revision,
    baseTerrainRevision: input.environment.terrainRevision,
    baseWaterSourceTerrainRevision: input.environment.waterSourceTerrainRevision,
    baseRoadRevision: input.environment.roadRevision,
    baseOccupancyRevision: input.environment.occupancyRevision,
    requestedCells: input.requestedCells,
    changedCells: input.changedCells,
    unchangedCells: input.unchangedCells,
    invalidCells: input.invalidCells,
    get proposedDefinitionCodes(): Uint8Array {
      return proposed.slice();
    },
    dirtyChunks: input.dirtyChunks,
    valid: input.invalidReason === null,
    invalidReason: input.invalidReason,
  });
}

export function planZoneMutation(
  zones: ZoneSnapshot,
  stroke: ZoneStrokeInput,
  environment: ZonePlacementEnvironment,
  config: WorldConfig,
): ZoneMutationPlan {
  let invalidReason: ZoneInvalidReason | null = null;
  let proposedCodes: Uint8Array;
  try {
    const validated = createZoneSnapshot(
      {
        width: zones.width,
        height: zones.height,
        revision: zones.revision,
        definitionCodes: zones.definitionCodes,
      },
      config,
    );
    proposedCodes = validated.definitionCodes;
  } catch {
    invalidReason = 'zone:invalid-state';
    proposedCodes = new Uint8Array(config.mapWidth * config.mapHeight);
  }

  if (invalidReason === null && !environmentIsValid(environment)) {
    invalidReason = 'zone:invalid-environment';
  }

  const normalized = normalizeCells(stroke.cells, config);
  if (invalidReason === null && !normalized.valid) invalidReason = 'zone:invalid-cell';
  const requestedCells = normalized.cells;

  let selectedCode: ZoneDefinitionCode | null = null;
  if (invalidReason === null) {
    if (stroke.operation === 'paint' && stroke.definitionId !== null) {
      try {
        selectedCode = zoneDefinitionForId(stroke.definitionId).code;
      } catch {
        invalidReason = 'zone:unknown-definition';
      }
    } else if (stroke.operation !== 'remove' || stroke.definitionId !== null) {
      invalidReason = 'zone:unknown-definition';
    }
  }

  const changed: CellCoord[] = [];
  const unchanged: CellCoord[] = [];
  const invalidCells: ZoneInvalidCell[] = [];

  if (invalidReason === null) {
    for (const cell of requestedCells) {
      const index = cellIndex(cell, config);
      const before = proposedCodes[index] as ZoneDefinitionCode;
      if (stroke.operation === 'remove') {
        if (before === EMPTY_ZONE_CODE) {
          unchanged.push(cell);
        } else {
          proposedCodes[index] = EMPTY_ZONE_CODE;
          changed.push(cell);
        }
        continue;
      }

      const reason = paintInvalidReason(
        zones,
        proposedCodes,
        cell,
        selectedCode!,
        environment,
        config,
      );
      if (reason === 'unchanged') {
        unchanged.push(cell);
      } else if (reason !== null) {
        invalidCells.push({ cell, reason });
      } else {
        proposedCodes[index] = selectedCode!;
        changed.push(cell);
      }
    }

    if (invalidCells.length > 0) {
      invalidReason = primaryReason(invalidCells.map((entry) => entry.reason));
    } else if (changed.length === 0) {
      invalidReason = 'zone:no-change';
    }
  }

  const changedCells = frozenCells(changed);
  const unchangedCells = frozenCells(unchanged);
  const frozenInvalid = frozenInvalidCells(invalidCells);
  const dirtyChunks =
    invalidReason === null
      ? frozenChunks(changedCells.map((cell) => chunkForCell(cell, config)))
      : Object.freeze([]);

  return createPlan({
    zones,
    stroke,
    environment,
    requestedCells,
    changedCells,
    unchangedCells,
    invalidCells: frozenInvalid,
    proposedDefinitionCodes: proposedCodes,
    dirtyChunks,
    invalidReason,
  });
}

function sameCells(first: readonly CellCoord[], second: readonly CellCoord[]): boolean {
  if (first.length !== second.length) return false;
  const remaining = new Set(second.map(cellKey));
  return first.every((cell) => remaining.delete(cellKey(cell))) && remaining.size === 0;
}

function sameCodes(first: Uint8Array, second: Uint8Array): boolean {
  return first.length === second.length && first.every((code, index) => code === second[index]);
}

export function commitZoneMutation(
  zones: ZoneSnapshot,
  plan: ZoneMutationPlan,
  environment: ZonePlacementEnvironment,
  config: WorldConfig,
): { readonly snapshot: ZoneSnapshot; readonly receipt: ZoneMutationReceipt } {
  if (!plan.valid || plan.invalidReason !== null) {
    throw new ZoneContractError('zone:invalid-plan');
  }
  if (zones.revision !== plan.baseZoneRevision) {
    throw new ZoneContractError('zone:stale-zone-plan');
  }
  if (environment.terrainRevision !== plan.baseTerrainRevision) {
    throw new ZoneContractError('zone:stale-terrain-plan');
  }
  if (environment.waterSourceTerrainRevision !== plan.baseWaterSourceTerrainRevision) {
    throw new ZoneContractError('zone:stale-water-plan');
  }
  if (environment.roadRevision !== plan.baseRoadRevision) {
    throw new ZoneContractError('zone:stale-road-plan');
  }
  if (environment.occupancyRevision !== plan.baseOccupancyRevision) {
    throw new ZoneContractError('zone:stale-occupancy-plan');
  }
  if (!environmentIsValid(environment)) {
    throw new ZoneContractError('zone:incoherent-world-revision');
  }

  try {
    const verified = planZoneMutation(
      zones,
      {
        operation: plan.operation,
        definitionId: plan.definitionId,
        cells: plan.requestedCells,
      },
      environment,
      config,
    );
    if (
      !verified.valid ||
      !sameCells(verified.changedCells, plan.changedCells) ||
      !sameCells(verified.unchangedCells, plan.unchangedCells) ||
      !sameCodes(verified.proposedDefinitionCodes, plan.proposedDefinitionCodes)
    ) {
      throw new ZoneContractError('zone:invalid-proposed-state');
    }

    const snapshot = createZoneSnapshot(
      {
        width: zones.width,
        height: zones.height,
        revision: zones.revision + 1,
        definitionCodes: verified.proposedDefinitionCodes,
      },
      config,
    );
    const receipt: ZoneMutationReceipt = Object.freeze({
      beforeRevision: zones.revision,
      afterRevision: snapshot.revision,
      operation: plan.operation,
      definitionId: plan.definitionId,
      changedCellCount: plan.changedCells.length,
      unchangedCellCount: plan.unchangedCells.length,
      dirtyChunks: frozenChunks(plan.dirtyChunks),
    });
    return Object.freeze({ snapshot, receipt });
  } catch (error) {
    if (error instanceof ZoneContractError) throw error;
    throw new ZoneContractError('zone:invalid-proposed-state');
  }
}
