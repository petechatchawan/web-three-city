#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

async function write(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

async function replaceOnce(path, search, replacement) {
  const source = await readFile(path, 'utf8');
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`authoring:missing-pattern:${path}:${search.slice(0, 80)}`);
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`authoring:ambiguous-pattern:${path}`);
  await writeFile(path, source.slice(0, index) + replacement + source.slice(index + search.length), 'utf8');
}

async function replaceRegex(path, pattern, replacement) {
  const source = await readFile(path, 'utf8');
  const matches = source.match(pattern);
  if (matches === null) throw new Error(`authoring:missing-regex:${path}:${pattern}`);
  await writeFile(path, source.replace(pattern, replacement), 'utf8');
}

await write(
  'apps/game/src/game-tool-mode.ts',
  `import type { WorldToolMode } from '@web-three-city/terrain-core';

export type RoadToolMode = 'road-build' | 'road-bulldoze';
export type ZoneToolMode = 'zone-residential' | 'zone-commercial' | 'zone-industrial' | 'zone-remove';
export type BuildingToolMode = 'building-develop' | 'building-bulldoze';
export type GameToolMode = WorldToolMode | RoadToolMode | ZoneToolMode | BuildingToolMode;

export function isRoadToolMode(mode: GameToolMode): mode is RoadToolMode {
  return mode === 'road-build' || mode === 'road-bulldoze';
}
export function isZoneToolMode(mode: GameToolMode): mode is ZoneToolMode {
  return mode === 'zone-residential' || mode === 'zone-commercial' || mode === 'zone-industrial' || mode === 'zone-remove';
}
export function isBuildingToolMode(mode: GameToolMode): mode is BuildingToolMode {
  return mode === 'building-develop' || mode === 'building-bulldoze';
}
export function isTerraformToolMode(mode: GameToolMode): mode is Exclude<WorldToolMode, 'navigate'> {
  return mode === 'raise' || mode === 'lower' || mode === 'flatten';
}
`,
);

await write(
  'apps/game/src/terraform-occupancy-guard.ts',
  `import { buildingOccupiedAt, type BuildingSnapshot } from '@web-three-city/building-core';
import { roadOccupiedAt, type RoadSnapshot } from '@web-three-city/road-core';
import type { TerraformInvalidReason, TerraformPlan } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';
import { zoneOccupiedAt, type ZoneSnapshot } from '@web-three-city/zone-core';

export type GameTerraformInvalidReason = TerraformInvalidReason | 'terraform:road-occupied' | 'terraform:zone-occupied' | 'terraform:building-occupied';
export interface GuardedTerraformCandidate {
  readonly corePlan: TerraformPlan;
  readonly previewPlan: TerraformPlan;
  readonly valid: boolean;
  readonly invalidReason: GameTerraformInvalidReason | null;
  readonly blockedRoadCells: readonly CellCoord[];
  readonly blockedZoneCells: readonly CellCoord[];
  readonly blockedBuildingCells: readonly CellCoord[];
}
export type GuardedTerraformPlan = GuardedTerraformCandidate;
const EMPTY_CELLS: readonly CellCoord[] = Object.freeze([]);

function blockedCellsFor(plan: TerraformPlan, width: number, height: number, occupiedAt: (cell: CellCoord) => boolean): readonly CellCoord[] {
  const blocked = new Map<string, CellCoord>();
  for (const vertex of plan.affectedVertices) {
    for (const cell of [{ x: vertex.x - 1, z: vertex.z - 1 }, { x: vertex.x, z: vertex.z - 1 }, { x: vertex.x - 1, z: vertex.z }, { x: vertex.x, z: vertex.z }]) {
      if (cell.x < 0 || cell.z < 0 || cell.x >= width || cell.z >= height || !occupiedAt(cell)) continue;
      blocked.set(`${cell.x}:${cell.z}`, cell);
    }
  }
  return Object.freeze([...blocked.values()].map((cell) => Object.freeze({ ...cell })).sort((a, b) => a.z - b.z || a.x - b.x));
}

export function guardTerraformPlanWithOccupancy(plan: TerraformPlan, roads: RoadSnapshot, zones: ZoneSnapshot, buildings: BuildingSnapshot): GuardedTerraformCandidate {
  const blockedRoadCells = blockedCellsFor(plan, roads.width, roads.height, (cell) => roadOccupiedAt(roads, cell));
  const blockedZoneCells = blockedCellsFor(plan, zones.width, zones.height, (cell) => zoneOccupiedAt(zones, cell));
  const blockedBuildingCells = blockedCellsFor(plan, zones.width, zones.height, (cell) => buildingOccupiedAt(buildings, cell));
  const occupancyReason: GameTerraformInvalidReason | null = blockedRoadCells.length > 0 ? 'terraform:road-occupied' : blockedBuildingCells.length > 0 ? 'terraform:building-occupied' : blockedZoneCells.length > 0 ? 'terraform:zone-occupied' : null;
  if (occupancyReason !== null) return Object.freeze({ corePlan: plan, previewPlan: plan.valid ? Object.freeze({ ...plan, valid: false }) : plan, valid: false, invalidReason: occupancyReason, blockedRoadCells, blockedZoneCells, blockedBuildingCells });
  if (!plan.valid) return Object.freeze({ corePlan: plan, previewPlan: plan, valid: false, invalidReason: plan.invalidReason, blockedRoadCells: EMPTY_CELLS, blockedZoneCells: EMPTY_CELLS, blockedBuildingCells: EMPTY_CELLS });
  return Object.freeze({ corePlan: plan, previewPlan: plan, valid: true, invalidReason: null, blockedRoadCells: EMPTY_CELLS, blockedZoneCells: EMPTY_CELLS, blockedBuildingCells: EMPTY_CELLS });
}
`,
);

await write(
  'apps/game/src/game-reason-catalog.ts',
  `import type { BuildingInvalidReason } from '@web-three-city/building-core';
import type { ZoneInvalidReason } from '@web-three-city/zone-core';
import type { GameRoadBuildingInvalidReason } from './road-building-guard.js';
import type { GameTerraformInvalidReason } from './terraform-occupancy-guard.js';
import type { GameZoneInvalidReason } from './zone-building-guard.js';

export type GameOperationReason = GameTerraformInvalidReason | GameRoadBuildingInvalidReason | GameZoneInvalidReason | BuildingInvalidReason;

const GAME_REASON_MESSAGES = {
  'terraform:height-range': 'This terrain cannot move farther in that direction',
  'terraform:cardinal-delta': 'Nearby terrain prevents this change',
  'terraform:no-change': 'No terrain change',
  'terraform:invalid-cell': 'Move the brush inside the map',
  'terraform:invalid-terrain': 'This terrain cannot be edited',
  'terraform:non-canonical-shape': 'This change cannot form a supported terrain shape',
  'terraform:propagation-blocked': 'Nearby terrain prevents this change',
  'terraform:propagation-limit': 'This change would affect too much surrounding terrain',
  'terraform:road-occupied': 'Remove the road before changing this terrain',
  'terraform:zone-occupied': 'Remove the zone before changing this terrain',
  'terraform:building-occupied': 'Bulldoze the building before changing this terrain',
  'road:invalid-state': 'The road network is unavailable; try again',
  'road:invalid-cell': 'Move the road inside the map',
  'road:incoherent-world-revision': 'The world changed; try again',
  'road:no-change': 'No road change',
  'road:unsupported-terrain': 'Roads require flat terrain or a supported straight ramp',
  'road:wet-cell': 'Roads cannot be placed on water',
  'road:invalid-ramp-topology': 'Roads on ramps must continue straight along the slope',
  'road:zone-occupied': 'Remove the zone before building a road here',
  'road:zone-access-lost': 'This road is required by an existing zone',
  'road:building-occupied': 'Bulldoze the building before placing a road here',
  'road:building-access-lost': 'This road provides required building frontage',
  'zone:invalid-state': 'The zone map is unavailable; try again',
  'zone:invalid-environment': 'The world changed; try zoning again',
  'zone:invalid-cell': 'Move the zone brush inside the map',
  'zone:unknown-definition': 'This zone type is unavailable',
  'zone:no-change': 'No zone change',
  'zone:unsupported-terrain': 'Zones require flat terrain',
  'zone:wet-cell': 'Zones cannot be painted on water',
  'zone:road-occupied': 'Zones cannot overlap roads',
  'zone:occupied': 'Another world object occupies this cell',
  'zone:zone-conflict': 'Remove the existing zone before changing its type',
  'zone:road-access-required': 'Zones must be within three cells of a road',
  'zone:building-occupied': 'Bulldoze the building before changing its Zone',
  'building:invalid-state': 'Building data is unavailable; try again',
  'building:invalid-environment': 'The world changed; try developing again',
  'building:invalid-cell': 'Select a cell inside the map',
  'building:no-change': 'No building change',
  'building:no-zoned-lot': 'Paint eligible Zones before developing',
  'building:no-compatible-definition': 'No compatible building content is available',
  'building:mixed-zone': 'A building footprint cannot span different Zone types',
  'building:unsupported-terrain': 'Buildings require flat terrain',
  'building:wet-cell': 'Buildings cannot be developed on water',
  'building:road-occupied': 'Buildings cannot overlap Roads',
  'building:occupied': 'A building already occupies this lot',
  'building:road-access-required': 'Buildings require deterministic Road frontage',
  'building:not-found': 'No building occupies the selected cell',
} satisfies Readonly<Record<GameOperationReason, string>>;

export function messageForGameReason(reason: GameOperationReason): string { return GAME_REASON_MESSAGES[reason]; }
`,
);

await write(
  'apps/game/src/world-undo.ts',
  `import { createBuildingSnapshot, type BuildingSnapshot } from '@web-three-city/building-core';
import { createRoadSnapshot, type RoadSnapshot } from '@web-three-city/road-core';
import { createTerrainMap, type TerrainSnapshot } from '@web-three-city/terrain-core';
import { createZoneSnapshot, type ZoneSnapshot } from '@web-three-city/zone-core';
import type { WorldConfig } from '@web-three-city/world-core';

export type WorldUndoEntry =
  | Readonly<{ readonly kind: 'terraform'; readonly terrain: TerrainSnapshot }>
  | Readonly<{ readonly kind: 'road'; readonly roads: RoadSnapshot }>
  | Readonly<{ readonly kind: 'zone'; readonly zones: ZoneSnapshot }>
  | Readonly<{ readonly kind: 'building'; readonly buildings: BuildingSnapshot }>;

function copyTerrain(snapshot: TerrainSnapshot, config: WorldConfig, revision = snapshot.revision): TerrainSnapshot { return createTerrainMap({ config, heightLevels: snapshot.heightLevels, seed: snapshot.seed, generatorVersion: snapshot.generatorVersion, generationAttempt: snapshot.generationAttempt, revision }); }
function copyRoads(snapshot: RoadSnapshot, config: WorldConfig, revision = snapshot.revision): RoadSnapshot { return createRoadSnapshot({ width: snapshot.width, height: snapshot.height, revision, definitionCodes: snapshot.definitionCodes }, config); }
function copyZones(snapshot: ZoneSnapshot, config: WorldConfig, revision = snapshot.revision): ZoneSnapshot { return createZoneSnapshot({ width: snapshot.width, height: snapshot.height, revision, definitionCodes: snapshot.definitionCodes }, config); }
function copyBuildings(snapshot: BuildingSnapshot, config: WorldConfig, revision = snapshot.revision): BuildingSnapshot { return createBuildingSnapshot({ revision, instances: snapshot.instances }, config); }
function copyEntry(entry: WorldUndoEntry, config: WorldConfig): WorldUndoEntry {
  switch (entry.kind) {
    case 'terraform': return Object.freeze({ kind: 'terraform' as const, terrain: copyTerrain(entry.terrain, config) });
    case 'road': return Object.freeze({ kind: 'road' as const, roads: copyRoads(entry.roads, config) });
    case 'zone': return Object.freeze({ kind: 'zone' as const, zones: copyZones(entry.zones, config) });
    case 'building': return Object.freeze({ kind: 'building' as const, buildings: copyBuildings(entry.buildings, config) });
  }
}
function restoredEntry(entry: WorldUndoEntry, config: WorldConfig): WorldUndoEntry {
  switch (entry.kind) {
    case 'terraform': return Object.freeze({ kind: 'terraform' as const, terrain: copyTerrain(entry.terrain, config, entry.terrain.revision + 2) });
    case 'road': return Object.freeze({ kind: 'road' as const, roads: copyRoads(entry.roads, config, entry.roads.revision + 2) });
    case 'zone': return Object.freeze({ kind: 'zone' as const, zones: copyZones(entry.zones, config, entry.zones.revision + 2) });
    case 'building': return Object.freeze({ kind: 'building' as const, buildings: copyBuildings(entry.buildings, config, entry.buildings.revision + 2) });
  }
}
export class WorldUndoStore {
  readonly #config: WorldConfig;
  #entry: WorldUndoEntry | null = null;
  constructor(config: WorldConfig) { this.#config = config; }
  get available(): boolean { return this.#entry !== null; }
  get kind(): WorldUndoEntry['kind'] | null { return this.#entry?.kind ?? null; }
  replace(entry: WorldUndoEntry): void { this.#entry = copyEntry(entry, this.#config); }
  consume(): WorldUndoEntry | null { const entry = this.#entry; if (entry === null) return null; this.#entry = null; return restoredEntry(entry, this.#config); }
  clear(): void { this.#entry = null; }
}
`,
);

await write(
  'apps/game/src/world-save.ts',
  `import {
  buildingDefinitionForId,
  createEmptyBuildingSnapshot,
  decodeBuildingSaveV1,
  encodeBuildingSaveV1,
  occupiedCellsForBuilding,
  resolveBuildingFrontage,
  type BuildingSaveV1,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import { createEmptyRoadSnapshot, decodeRoadSaveV1, encodeRoadSaveV1, roadCellPolicyInvalidReason, roadOccupiedAt, type RoadPlacementEnvironment, type RoadSaveV1, type RoadSnapshot } from '@web-three-city/road-core';
import { decodeTerrainSaveV1, encodeTerrainSaveV1, type TerrainSaveV1, type TerrainSnapshot } from '@web-three-city/terrain-core';
import { deriveWaterSnapshot, type WaterSnapshot } from '@web-three-city/water-core';
import { createEmptyZoneSnapshot, decodeZoneSaveV1, encodeZoneSaveV1, zoneCellPolicyInvalidReason, zoneOccupiedAt, type ZonePlacementEnvironment, type ZoneSaveV1, type ZoneSnapshot } from '@web-three-city/zone-core';
import { err, ok, type Result, type WorldConfig } from '@web-three-city/world-core';
import { createBuildingDevelopmentEnvironment } from './building-development-environment.js';
import { createBuildingWorldOccupancy } from './building-world-occupancy.js';
import { createRoadPlacementEnvironment } from './road-placement-environment.js';
import { createZonePlacementEnvironment } from './zone-placement-environment.js';

export interface WorldSaveV1 { readonly kind: 'world-save'; readonly schemaVersion: 1; readonly terrain: TerrainSaveV1; readonly roads: RoadSaveV1; }
export interface WorldSaveV2 { readonly kind: 'world-save'; readonly schemaVersion: 2; readonly terrain: TerrainSaveV1; readonly roads: RoadSaveV1; readonly zones: ZoneSaveV1; }
export interface WorldSaveV3 { readonly kind: 'world-save'; readonly schemaVersion: 3; readonly terrain: TerrainSaveV1; readonly roads: RoadSaveV1; readonly zones: ZoneSaveV1; readonly buildings: BuildingSaveV1; }
export interface DecodedWorldState { readonly terrain: TerrainSnapshot; readonly water: WaterSnapshot; readonly roads: RoadSnapshot; readonly roadEnvironment: RoadPlacementEnvironment; readonly zones: ZoneSnapshot; readonly zoneEnvironment: ZonePlacementEnvironment; readonly buildings: BuildingSnapshot; readonly buildingEnvironment: ReturnType<typeof createBuildingDevelopmentEnvironment>; }
export type WorldSaveErrorCode = 'world-save:invalid-schema' | 'world-save:invalid-terrain' | 'world-save:invalid-water' | 'world-save:invalid-roads' | 'world-save:invalid-road-environment' | 'world-save:invalid-road-placement' | 'world-save:invalid-zones' | 'world-save:invalid-zone-environment' | 'world-save:invalid-zone-placement' | 'world-save:invalid-buildings' | 'world-save:invalid-building-environment' | 'world-save:invalid-building-placement';
export interface WorldSaveError { readonly code: WorldSaveErrorCode; readonly details?: Readonly<Record<string, unknown>>; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function isWorldEnvelope(input: unknown): input is Record<string, unknown> { return isRecord(input) && (input.kind === 'world-save' || 'roads' in input || 'terrain' in input); }
export function encodeWorldSaveV1(terrain: TerrainSnapshot, roads: RoadSnapshot): WorldSaveV1 { return Object.freeze({ kind: 'world-save', schemaVersion: 1, terrain: encodeTerrainSaveV1(terrain), roads: encodeRoadSaveV1(roads) }); }
export function encodeWorldSaveV2(terrain: TerrainSnapshot, roads: RoadSnapshot, zones: ZoneSnapshot): WorldSaveV2 { return Object.freeze({ kind: 'world-save', schemaVersion: 2, terrain: encodeTerrainSaveV1(terrain), roads: encodeRoadSaveV1(roads), zones: encodeZoneSaveV1(zones) }); }
export function encodeWorldSaveV3(terrain: TerrainSnapshot, roads: RoadSnapshot, zones: ZoneSnapshot, buildings: BuildingSnapshot): WorldSaveV3 { return Object.freeze({ kind: 'world-save', schemaVersion: 3, terrain: encodeTerrainSaveV1(terrain), roads: encodeRoadSaveV1(roads), zones: encodeZoneSaveV1(zones), buildings: encodeBuildingSaveV1(buildings) }); }

export function decodeWorldSave(input: unknown, config: WorldConfig): Result<DecodedWorldState, WorldSaveError> {
  let terrainInput: unknown = input; let roadInput: unknown = null; let zoneInput: unknown = null; let buildingInput: unknown = null; let schemaVersion: 0 | 1 | 2 | 3 = 0;
  if (isWorldEnvelope(input)) {
    if (input.kind !== 'world-save' || (input.schemaVersion !== 1 && input.schemaVersion !== 2 && input.schemaVersion !== 3) || !('terrain' in input) || !('roads' in input) || (input.schemaVersion >= 2 && !('zones' in input)) || (input.schemaVersion === 3 && !('buildings' in input))) return err({ code: 'world-save:invalid-schema' });
    terrainInput = input.terrain; roadInput = input.roads; zoneInput = input.schemaVersion >= 2 ? input.zones : null; buildingInput = input.schemaVersion === 3 ? input.buildings : null; schemaVersion = input.schemaVersion;
  }
  const terrainResult = decodeTerrainSaveV1(terrainInput); if (!terrainResult.ok) return err({ code: 'world-save:invalid-terrain', details: Object.freeze({ terrainCode: terrainResult.error.code }) }); const terrain = terrainResult.value;
  const waterResult = deriveWaterSnapshot(terrain, config); if (!waterResult.ok) return err({ code: 'world-save:invalid-water', details: Object.freeze({ waterCode: waterResult.error.code }) }); const water = waterResult.value;
  let roads: RoadSnapshot;
  if (schemaVersion === 0) roads = createEmptyRoadSnapshot(config); else { const result = decodeRoadSaveV1(roadInput, config); if (!result.ok) return err({ code: 'world-save:invalid-roads', details: Object.freeze({ roadCode: result.error.code }) }); roads = result.value; }
  let roadEnvironment: RoadPlacementEnvironment; try { roadEnvironment = createRoadPlacementEnvironment(terrain, water, config); } catch { return err({ code: 'world-save:invalid-road-environment' }); }
  for (let z = 0; z < config.mapHeight; z += 1) for (let x = 0; x < config.mapWidth; x += 1) { const cell = { x, z }; if (roadOccupiedAt(roads, cell)) { const reason = roadCellPolicyInvalidReason(roads, cell, roadEnvironment, config); if (reason !== null) return err({ code: 'world-save:invalid-road-placement', details: Object.freeze({ reason }) }); } }
  let zones: ZoneSnapshot;
  if (schemaVersion < 2) zones = createEmptyZoneSnapshot(config); else { const result = decodeZoneSaveV1(zoneInput, config); if (!result.ok) return err({ code: 'world-save:invalid-zones', details: Object.freeze({ zoneCode: result.error.code }) }); zones = result.value; }
  const emptyOccupancy = Object.freeze({ revision: 0, isBlocked: () => false });
  let validationZoneEnvironment: ZonePlacementEnvironment; try { validationZoneEnvironment = createZonePlacementEnvironment(terrain, water, roads, emptyOccupancy, config); } catch { return err({ code: 'world-save:invalid-zone-environment' }); }
  for (let z = 0; z < config.mapHeight; z += 1) for (let x = 0; x < config.mapWidth; x += 1) { const cell = { x, z }; if (zoneOccupiedAt(zones, cell)) { const reason = zoneCellPolicyInvalidReason(zones, cell, validationZoneEnvironment, config); if (reason !== null) return err({ code: 'world-save:invalid-zone-placement', details: Object.freeze({ reason, cell: Object.freeze(cell) }) }); } }
  let buildings: BuildingSnapshot;
  if (schemaVersion < 3) buildings = createEmptyBuildingSnapshot(config); else { const result = decodeBuildingSaveV1(buildingInput, config); if (!result.ok) return err({ code: 'world-save:invalid-buildings', details: Object.freeze({ buildingCode: result.error.code }) }); buildings = result.value; }
  let buildingEnvironment: ReturnType<typeof createBuildingDevelopmentEnvironment>; try { buildingEnvironment = createBuildingDevelopmentEnvironment(terrain, water, roads, zones, config); } catch { return err({ code: 'world-save:invalid-building-environment' }); }
  for (const instance of buildings.instances) {
    const definition = buildingDefinitionForId(instance.buildingDefinitionId); const cells = occupiedCellsForBuilding(instance); const zoneIds = new Set(cells.map((cell) => buildingEnvironment.zoneDefinitionIdAt(cell)));
    const invalid = zoneIds.size !== 1 || zoneIds.has(null) || !definition.compatibleZoneDefinitionIds.includes([...zoneIds][0]!) || cells.some((cell) => !buildingEnvironment.isDry(cell) || buildingEnvironment.surfaceAt(cell).shape !== 'flat' || buildingEnvironment.isRoadOccupied(cell)) || resolveBuildingFrontage(instance, buildingEnvironment) === null;
    if (invalid) return err({ code: 'world-save:invalid-building-placement', details: Object.freeze({ instanceId: instance.instanceId }) });
  }
  let zoneEnvironment: ZonePlacementEnvironment; try { zoneEnvironment = createZonePlacementEnvironment(terrain, water, roads, createBuildingWorldOccupancy(buildings), config); } catch { return err({ code: 'world-save:invalid-zone-environment' }); }
  return ok(Object.freeze({ terrain, water, roads, roadEnvironment, zones, zoneEnvironment, buildings, buildingEnvironment }));
}
`,
);

await write(
  'apps/game/src/terraform-building-guard.test.ts',
  `import { describe, expect, it } from 'vitest';
import { createBuildingSnapshot } from '@web-three-city/building-core';
import { createEmptyRoadSnapshot } from '@web-three-city/road-core';
import { createEmptyZoneSnapshot } from '@web-three-city/zone-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { guardTerraformPlanWithOccupancy } from './terraform-occupancy-guard.js';

describe('terraform building occupancy', () => {
  it('rejects vertices touching an occupied Building cell', () => {
    const buildings = createBuildingSnapshot({ revision: 1, instances: [{ instanceId: 'b', buildingDefinitionId: 'residential-cottage-1x1', buildingDefinitionVersion: 1, originCell: { x: 2, z: 2 }, rotationQuarterTurns: 0 }] }, WORLD_CONFIG);
    const plan = { valid: true, invalidReason: null, affectedVertices: [{ x: 2, z: 2 }] } as unknown as Parameters<typeof guardTerraformPlanWithOccupancy>[0];
    expect(guardTerraformPlanWithOccupancy(plan, createEmptyRoadSnapshot(WORLD_CONFIG), createEmptyZoneSnapshot(WORLD_CONFIG), buildings)).toMatchObject({ valid: false, invalidReason: 'terraform:building-occupied' });
  });
});
`,
);

await replaceOnce('apps/game/package.json', '    "@web-three-city/camera-input": "workspace:*",\n', '    "@web-three-city/building-core": "workspace:*",\n    "@web-three-city/building-three": "workspace:*",\n    "@web-three-city/camera-input": "workspace:*",\n');
await replaceOnce('apps/game/src/game-tool-events.ts', "export type GameTransactionDomain = 'terraform' | 'road' | 'zone';", "export type GameTransactionDomain = 'terraform' | 'road' | 'zone' | 'building';");
await replaceOnce('apps/game/src/game-tool-presentation.ts', "export type GameTransactionDomain = 'terraform' | 'road' | 'zone';", "export type GameTransactionDomain = 'terraform' | 'road' | 'zone' | 'building';");

await replaceOnce('apps/game/src/game-tool-hud-binding.ts', "    '[data-action=\"tool-zone-remove\"]',\n", "    '[data-action=\"tool-zone-remove\"]',\n    '[data-action=\"tool-building-develop\"]',\n    '[data-action=\"tool-building-bulldoze\"]',\n");
await replaceOnce('apps/game/src/game-tool-hud-binding.ts', "          const domain =\n            detail.domain === 'terraform' ? 'Terrain' : detail.domain === 'road' ? 'Road' : 'Zone';", "          const domain = detail.domain === 'terraform' ? 'Terrain' : detail.domain === 'road' ? 'Road' : detail.domain === 'zone' ? 'Zone' : 'Building';");

await replaceOnce('apps/game/src/main.ts', "  'zone-remove': 'tool-zone-remove',\n", "  'zone-remove': 'tool-zone-remove',\n  'building-develop': 'tool-building-develop',\n  'building-bulldoze': 'tool-building-bulldoze',\n");
await replaceOnce('apps/game/src/main.ts', "    evidence?.zone.strokeActive === true\n", "    evidence?.zone.strokeActive === true ||\n    evidence?.building.strokeActive === true\n");

await replaceOnce('apps/game/src/game-ui.ts', "import type { ZoneCounts } from '@web-three-city/zone-core';\n", "import type { ZoneCounts } from '@web-three-city/zone-core';\n");
await replaceOnce('apps/game/src/game-ui.ts', "  readonly zoneRemoveButton: HTMLButtonElement;\n", "  readonly zoneRemoveButton: HTMLButtonElement;\n  readonly buildingDevelopButton: HTMLButtonElement;\n  readonly buildingBulldozeButton: HTMLButtonElement;\n");
await replaceOnce('apps/game/src/game-ui.ts', "  setZoneCounts(counts: ZoneCounts): void;\n", "  setZoneCounts(counts: ZoneCounts): void;\n  setBuildingCount(count: number): void;\n");
await replaceOnce('apps/game/src/game-ui.ts', "    case 'zone-remove':\n      return 'Remove Zone';\n", "    case 'zone-remove':\n      return 'Remove Zone';\n    case 'building-develop':\n      return 'Develop Zones';\n    case 'building-bulldoze':\n      return 'Bulldoze Building';\n");
await replaceOnce('apps/game/src/game-ui.ts', "              <button type=\"button\" data-action=\"tool-zone-remove\" aria-pressed=\"false\">Remove Zone</button>\n", "              <button type=\"button\" data-action=\"tool-zone-remove\" aria-pressed=\"false\">Remove Zone</button>\n              <button type=\"button\" data-action=\"tool-building-develop\" aria-label=\"Develop Zones\" aria-pressed=\"false\">Develop Zones</button>\n              <button type=\"button\" data-action=\"tool-building-bulldoze\" aria-label=\"Bulldoze Building\" aria-pressed=\"false\">Bulldoze Building</button>\n");
await replaceOnce('apps/game/src/game-ui.ts', "              <div class=\"metrics-row zone-counts\" aria-label=\"Committed zone counts\">\n", "              <div class=\"metrics-row\"><span>Buildings</span><strong data-testid=\"building-count\">0</strong></div>\n              <div class=\"metrics-row zone-counts\" aria-label=\"Committed zone counts\">\n");
await replaceOnce('apps/game/src/game-ui.ts', "  const zoneIndustrialCount = requireElement<HTMLElement>(\n    root,\n    '[data-testid=\"zone-industrial-count\"]',\n  );\n", "  const zoneIndustrialCount = requireElement<HTMLElement>(\n    root,\n    '[data-testid=\"zone-industrial-count\"]',\n  );\n  const buildingCountValue = requireElement<HTMLElement>(root, '[data-testid=\"building-count\"]');\n");
await replaceOnce('apps/game/src/game-ui.ts', "  const zoneRemoveButton = requireElement<HTMLButtonElement>(\n    root,\n    '[data-action=\"tool-zone-remove\"]',\n  );\n", "  const zoneRemoveButton = requireElement<HTMLButtonElement>(\n    root,\n    '[data-action=\"tool-zone-remove\"]',\n  );\n  const buildingDevelopButton = requireElement<HTMLButtonElement>(root, '[data-action=\"tool-building-develop\"]');\n  const buildingBulldozeButton = requireElement<HTMLButtonElement>(root, '[data-action=\"tool-building-bulldoze\"]');\n");
await replaceOnce('apps/game/src/game-ui.ts', "    'zone-remove': zoneRemoveButton,\n", "    'zone-remove': zoneRemoveButton,\n    'building-develop': buildingDevelopButton,\n    'building-bulldoze': buildingBulldozeButton,\n");
await replaceOnce('apps/game/src/game-ui.ts', "            : isZoneToolMode(state.mode)\n              ? state.mode === 'zone-remove'\n                ? 'Drag across Zone cells and release to remove them.'\n                : 'Drag across eligible cells and release to paint the Zone.'\n              : 'Drag across Terrain and release to apply accepted stamps.';", "            : isZoneToolMode(state.mode)\n              ? state.mode === 'zone-remove'\n                ? 'Drag across Zone cells and release to remove them.'\n                : 'Drag across eligible cells and release to paint the Zone.'\n              : state.mode === 'building-develop'\n                ? 'Release on the world to develop all eligible Zoned lots.'\n                : state.mode === 'building-bulldoze'\n                  ? 'Release on a Building footprint to bulldoze that Building.'\n                  : 'Drag across Terrain and release to apply accepted stamps.';");
await replaceOnce('apps/game/src/game-ui.ts', "    zoneRemoveButton,\n    closeToolButton,\n", "    zoneRemoveButton,\n    buildingDevelopButton,\n    buildingBulldozeButton,\n    closeToolButton,\n");
await replaceOnce('apps/game/src/game-ui.ts', "    setZoneCounts(counts: ZoneCounts): void {\n      zoneResidentialCount.textContent = String(counts.residential);\n      zoneCommercialCount.textContent = String(counts.commercial);\n      zoneIndustrialCount.textContent = String(counts.industrial);\n    },\n", "    setZoneCounts(counts: ZoneCounts): void {\n      zoneResidentialCount.textContent = String(counts.residential);\n      zoneCommercialCount.textContent = String(counts.commercial);\n      zoneIndustrialCount.textContent = String(counts.industrial);\n    },\n    setBuildingCount(count: number): void { buildingCountValue.textContent = String(count); },\n");

await replaceOnce('apps/game/src/game-input.ts', "import {\n  CameraInteractionController,", "import type { BuildingToolMode } from './game-tool-mode.js';\nimport { createBuildingToolController, type BuildingInputState } from './building-tool-controller.js';\nimport {\n  CameraInteractionController,");
await replaceOnce('apps/game/src/game-input.ts', "  isRoadToolMode,\n  isTerraformToolMode,", "  isBuildingToolMode,\n  isRoadToolMode,\n  isTerraformToolMode,");
await replaceOnce('apps/game/src/game-input.ts', "  getZoneState(): ZoneInputState;\n", "  getZoneState(): ZoneInputState;\n  getBuildingState(): BuildingInputState;\n");
await replaceOnce('apps/game/src/game-input.ts', "  readonly onZonePlan: (plan: ZoneMutationPlan) => void;\n", "  readonly guardZonePlan?: (plan: ZoneMutationPlan) => { readonly previewPlan: ZoneMutationPlan; readonly valid: boolean; readonly invalidReason: import('./zone-building-guard.js').GameZoneInvalidReason | null };\n  readonly onZonePlan: (plan: ZoneMutationPlan, reason?: import('./zone-building-guard.js').GameZoneInvalidReason | null) => void;\n  readonly onBuildingRequest: (mode: BuildingToolMode, cell: CellCoord) => void;\n");
await replaceOnce('apps/game/src/game-input.ts', "  const rejectTerraform =", "  const buildingController = createBuildingToolController(() => (isBuildingToolMode(mode) ? mode : null));\n\n  const rejectTerraform =");
await replaceOnce('apps/game/src/game-input.ts', "      if (isRoadToolMode(mode)) return roadController.begin(pointerId, cell);\n      if (isZoneToolMode(mode)) return zoneController.begin(pointerId, cell);\n", "      if (isRoadToolMode(mode)) return roadController.begin(pointerId, cell);\n      if (isZoneToolMode(mode)) return zoneController.begin(pointerId, cell);\n      if (isBuildingToolMode(mode)) return buildingController.begin(pointerId, cell);\n");
await replaceOnce('apps/game/src/game-input.ts', "      if (isRoadToolMode(mode)) roadController.move(pointerId, cell);\n      else if (isZoneToolMode(mode)) zoneController.move(pointerId, cell);\n", "      if (isRoadToolMode(mode)) roadController.move(pointerId, cell);\n      else if (isZoneToolMode(mode)) zoneController.move(pointerId, cell);\n      else if (isBuildingToolMode(mode)) buildingController.move(pointerId, cell);\n");
await replaceOnce('apps/game/src/game-input.ts', "      if (isZoneToolMode(mode)) {\n        const finalPlan = zoneController.end(pointerId, cell);", "      if (isZoneToolMode(mode)) {\n        const rawPlan = zoneController.end(pointerId, cell);\n        const candidate = rawPlan === null ? null : options.guardZonePlan?.(rawPlan) ?? { previewPlan: rawPlan, valid: rawPlan.valid, invalidReason: rawPlan.invalidReason };\n        const finalPlan = candidate?.previewPlan ?? null;");
await replaceOnce('apps/game/src/game-input.ts', "        if (finalPlan !== null) options.onZonePlan(finalPlan);\n        return;\n      }\n      if (!isTerraformToolMode(mode)) return;", "        if (finalPlan !== null) options.onZonePlan(finalPlan, candidate?.invalidReason ?? null);\n        return;\n      }\n      if (isBuildingToolMode(mode)) {\n        const request = buildingController.end(pointerId, cell);\n        if (request !== null) options.onBuildingRequest(request.mode, request.cell);\n        return;\n      }\n      if (!isTerraformToolMode(mode)) return;");
await replaceOnce('apps/game/src/game-input.ts', "      zoneController.cancel(pointerId);\n      terraformSession.cancel(pointerId);", "      zoneController.cancel(pointerId);\n      buildingController.cancel(pointerId);\n      terraformSession.cancel(pointerId);");
await replaceOnce('apps/game/src/game-input.ts', "      zoneController.cancelAll();\n      terraformSession.cancelAll();", "      zoneController.cancelAll();\n      buildingController.cancelAll();\n      terraformSession.cancelAll();");
await replaceOnce('apps/game/src/game-input.ts', "    roadController.cancelAll();\n    terraformSession.cancelAll();", "    roadController.cancelAll();\n    zoneController.cancelAll();\n    buildingController.cancelAll();\n    terraformSession.cancelAll();");
await replaceOnce('apps/game/src/game-input.ts', "        value !== 'zone-remove'\n", "        value !== 'zone-remove' &&\n        value !== 'building-develop' &&\n        value !== 'building-bulldoze'\n");
await replaceOnce('apps/game/src/game-input.ts', "        mode: isRoadToolMode(mode) || isZoneToolMode(mode) ? 'navigate' : mode,", "        mode: isRoadToolMode(mode) || isZoneToolMode(mode) || isBuildingToolMode(mode) ? 'navigate' : mode,");
await replaceOnce('apps/game/src/game-input.ts', "    getZoneState(): ZoneInputState {\n      return zoneController.getState();\n    },\n", "    getZoneState(): ZoneInputState { return zoneController.getState(); },\n    getBuildingState(): BuildingInputState { return buildingController.getState(); },\n");
await replaceOnce('apps/game/src/game-input.ts', "      zoneController.cancelAll();\n      terraformSession.cancelAll();\n      options.preview.clear();", "      zoneController.cancelAll();\n      buildingController.cancelAll();\n      terraformSession.cancelAll();\n      options.preview.clear();");

console.log('Generated Building Foundation part 2');
