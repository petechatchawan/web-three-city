import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_ZONE_CODE,
  EMPTY_ZONE_CODE,
  RESIDENTIAL_ZONE_CODE,
  ZoneContractError,
  commitZoneMutation,
  createEmptyZoneSnapshot,
  createZoneSnapshot,
  planZoneMutation,
  zoneDefinitionCodeAt,
  type ZonePlacementEnvironment,
  type ZoneRoadAccess,
  type ZoneSnapshot,
} from '../src/index.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;

function key(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function flat(level = 1): TerrainCellSurfaceProfile {
  return Object.freeze({
    cell: Object.freeze({ x: 0, z: 0 }),
    corners: Object.freeze({ nw: level, ne: level, sw: level, se: level }),
    shape: 'flat',
    minimumLevel: level,
    maximumLevel: level,
    slopeAxis: null,
  });
}

function ramp(): TerrainCellSurfaceProfile {
  return Object.freeze({
    cell: Object.freeze({ x: 0, z: 0 }),
    corners: Object.freeze({ nw: 2, ne: 2, sw: 1, se: 1 }),
    shape: 'ramp-north',
    minimumLevel: 1,
    maximumLevel: 2,
    slopeAxis: 'north-south',
  });
}

function access(cell: CellCoord): ZoneRoadAccess {
  return Object.freeze({
    direction: 'north',
    distance: 1,
    roadCell: Object.freeze({ x: cell.x, z: cell.z - 1 }),
  });
}

function environment(input: {
  readonly wet?: readonly CellCoord[];
  readonly roads?: readonly CellCoord[];
  readonly blocked?: readonly CellCoord[];
  readonly inaccessible?: readonly CellCoord[];
  readonly ramps?: readonly CellCoord[];
  readonly terrainRevision?: number;
  readonly waterSourceTerrainRevision?: number;
  readonly roadRevision?: number;
  readonly occupancyRevision?: number;
} = {}): ZonePlacementEnvironment {
  const wet = new Set((input.wet ?? []).map(key));
  const roads = new Set((input.roads ?? []).map(key));
  const blocked = new Set((input.blocked ?? []).map(key));
  const inaccessible = new Set((input.inaccessible ?? []).map(key));
  const ramps = new Set((input.ramps ?? []).map(key));
  return Object.freeze({
    terrainRevision: input.terrainRevision ?? 5,
    waterSourceTerrainRevision: input.waterSourceTerrainRevision ?? 5,
    roadRevision: input.roadRevision ?? 3,
    occupancyRevision: input.occupancyRevision ?? 7,
    surfaceAt(cell: CellCoord) {
      return ramps.has(key(cell)) ? ramp() : flat();
    },
    isDry(cell: CellCoord) {
      return !wet.has(key(cell));
    },
    isRoadOccupied(cell: CellCoord) {
      return roads.has(key(cell));
    },
    roadAccessAt(cell: CellCoord) {
      return inaccessible.has(key(cell)) ? null : access(cell);
    },
    isBlockedByNonZoneOccupancy(cell: CellCoord) {
      return blocked.has(key(cell));
    },
  });
}

function zonesWith(entries: readonly [CellCoord, number][]): ZoneSnapshot {
  const codes = new Uint8Array(CELL_COUNT);
  for (const [cell, code] of entries) codes[cell.z * WORLD_CONFIG.mapWidth + cell.x] = code;
  return createZoneSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 2,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

describe('Zone mutation planning', () => {
  it('plans and commits an all-valid Paint transaction once', () => {
    const zones = createEmptyZoneSnapshot(WORLD_CONFIG);
    const cells = [
      { x: 10, z: 10 },
      { x: 11, z: 10 },
    ];
    const env = environment();
    const plan = planZoneMutation(
      zones,
      { operation: 'paint', definitionId: 'residential', cells },
      env,
      WORLD_CONFIG,
    );

    expect(plan.valid).toBe(true);
    expect(plan.invalidReason).toBeNull();
    expect(plan.changedCells).toEqual(cells);
    expect(plan.invalidCells).toEqual([]);
    expect(plan.dirtyChunks).toHaveLength(1);

    const result = commitZoneMutation(zones, plan, env, WORLD_CONFIG);
    expect(result.snapshot.revision).toBe(1);
    expect(zoneDefinitionCodeAt(result.snapshot, cells[0]!)).toBe(RESIDENTIAL_ZONE_CODE);
    expect(zoneDefinitionCodeAt(result.snapshot, cells[1]!)).toBe(RESIDENTIAL_ZONE_CODE);
    expect(result.receipt).toMatchObject({
      beforeRevision: 0,
      afterRevision: 1,
      operation: 'paint',
      definitionId: 'residential',
      changedCellCount: 2,
    });
  });

  it('ignores same-type cells but rejects a different Zone type atomically', () => {
    const residential = { x: 10, z: 10 };
    const commercial = { x: 11, z: 10 };
    const empty = { x: 12, z: 10 };
    const zones = zonesWith([
      [residential, RESIDENTIAL_ZONE_CODE],
      [commercial, COMMERCIAL_ZONE_CODE],
    ]);
    const plan = planZoneMutation(
      zones,
      {
        operation: 'paint',
        definitionId: 'residential',
        cells: [residential, commercial, empty],
      },
      environment(),
      WORLD_CONFIG,
    );

    expect(plan.valid).toBe(false);
    expect(plan.invalidReason).toBe('zone:zone-conflict');
    expect(plan.changedCells).toEqual([empty]);
    expect(plan.unchangedCells).toContainEqual(residential);
    expect(plan.invalidCells).toContainEqual({ cell: commercial, reason: 'zone:zone-conflict' });
    expect(() => commitZoneMutation(zones, plan, environment(), WORLD_CONFIG)).toThrow(
      new ZoneContractError('zone:invalid-plan'),
    );
  });

  it.each([
    ['zone:road-occupied', { roads: [{ x: 10, z: 10 }] }],
    ['zone:occupied', { blocked: [{ x: 10, z: 10 }] }],
    ['zone:wet-cell', { wet: [{ x: 10, z: 10 }] }],
    ['zone:unsupported-terrain', { ramps: [{ x: 10, z: 10 }] }],
    ['zone:road-access-required', { inaccessible: [{ x: 10, z: 10 }] }],
  ] as const)('rejects invalid Paint cells with %s', (reason, input) => {
    const cell = { x: 10, z: 10 };
    const plan = planZoneMutation(
      createEmptyZoneSnapshot(WORLD_CONFIG),
      { operation: 'paint', definitionId: 'commercial', cells: [cell] },
      environment(input),
      WORLD_CONFIG,
    );
    expect(plan.valid).toBe(false);
    expect(plan.invalidReason).toBe(reason);
    expect(plan.invalidCells).toEqual([{ cell, reason }]);
  });

  it('uses deterministic transaction reason precedence', () => {
    const road = { x: 10, z: 10 };
    const wet = { x: 11, z: 10 };
    const plan = planZoneMutation(
      createEmptyZoneSnapshot(WORLD_CONFIG),
      { operation: 'paint', definitionId: 'industrial', cells: [wet, road] },
      environment({ roads: [road], wet: [wet] }),
      WORLD_CONFIG,
    );
    expect(plan.invalidReason).toBe('zone:road-occupied');
    expect(plan.invalidCells).toEqual([
      { cell: wet, reason: 'zone:wet-cell' },
      { cell: road, reason: 'zone:road-occupied' },
    ]);
  });

  it('removes invalidly placed legacy Zones without placement eligibility', () => {
    const cell = { x: 10, z: 10 };
    const zones = zonesWith([[cell, COMMERCIAL_ZONE_CODE]]);
    const env = environment({ wet: [cell], roads: [cell], blocked: [cell], inaccessible: [cell] });
    const plan = planZoneMutation(
      zones,
      { operation: 'remove', definitionId: null, cells: [cell] },
      env,
      WORLD_CONFIG,
    );
    expect(plan.valid).toBe(true);
    const result = commitZoneMutation(zones, plan, env, WORLD_CONFIG);
    expect(zoneDefinitionCodeAt(result.snapshot, cell)).toBe(EMPTY_ZONE_CODE);
  });

  it('rejects no-change Paint and Remove transactions', () => {
    const cell = { x: 10, z: 10 };
    const zones = zonesWith([[cell, RESIDENTIAL_ZONE_CODE]]);
    expect(
      planZoneMutation(
        zones,
        { operation: 'paint', definitionId: 'residential', cells: [cell] },
        environment(),
        WORLD_CONFIG,
      ).invalidReason,
    ).toBe('zone:no-change');
    expect(
      planZoneMutation(
        zones,
        { operation: 'remove', definitionId: null, cells: [{ x: 12, z: 12 }] },
        environment(),
        WORLD_CONFIG,
      ).invalidReason,
    ).toBe('zone:no-change');
  });

  it('rejects stale Zone, Terrain, Water, Road, and occupancy revisions', () => {
    const zones = createEmptyZoneSnapshot(WORLD_CONFIG);
    const cell = { x: 10, z: 10 };
    const env = environment();
    const plan = planZoneMutation(
      zones,
      { operation: 'paint', definitionId: 'residential', cells: [cell] },
      env,
      WORLD_CONFIG,
    );

    const staleZones = createZoneSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 1,
        definitionCodes: zones.definitionCodes,
      },
      WORLD_CONFIG,
    );
    expect(() => commitZoneMutation(staleZones, plan, env, WORLD_CONFIG)).toThrow(
      'zone:stale-zone-plan',
    );
    expect(() =>
      commitZoneMutation(zones, plan, environment({ terrainRevision: 6 }), WORLD_CONFIG),
    ).toThrow('zone:stale-terrain-plan');
    expect(() =>
      commitZoneMutation(
        zones,
        plan,
        environment({ waterSourceTerrainRevision: 6 }),
        WORLD_CONFIG,
      ),
    ).toThrow('zone:stale-water-plan');
    expect(() =>
      commitZoneMutation(zones, plan, environment({ roadRevision: 4 }), WORLD_CONFIG),
    ).toThrow('zone:stale-road-plan');
    expect(() =>
      commitZoneMutation(zones, plan, environment({ occupancyRevision: 8 }), WORLD_CONFIG),
    ).toThrow('zone:stale-occupancy-plan');
  });
});
