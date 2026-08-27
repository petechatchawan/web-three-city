import { macroHourDuration, macroHourValue } from '@web-three-city/simulation-core';
import { zoneDefinitionForId } from '@web-three-city/zone-core';
import type {
  BuildingDefinition,
  BuildingDefinitionId,
  BuildingRotationQuarterTurns,
} from './contracts.js';

const ALL_ROTATIONS: readonly BuildingRotationQuarterTurns[] = Object.freeze([0, 1, 2, 3]);
const CAPACITY_PROFILE_ID =
  /^capacity\.(residential|commercial|industrial)\.[a-z0-9-]+\.v[1-9][0-9]*$/;

function definition(value: BuildingDefinition): BuildingDefinition {
  const rotations = [...value.allowedRotationQuarterTurns];
  const zoneIds = [...value.compatibleZoneDefinitionIds];
  try {
    for (const zoneId of zoneIds) zoneDefinitionForId(zoneId);
  } catch {
    throw new RangeError('building-definition:invalid');
  }
  if (
    !Number.isSafeInteger(value.footprintWidth) ||
    value.footprintWidth <= 0 ||
    !Number.isSafeInteger(value.footprintDepth) ||
    value.footprintDepth <= 0 ||
    !Number.isSafeInteger(value.selectionPriority) ||
    value.selectionPriority < 0 ||
    !Number.isSafeInteger(value.selectionWeight) ||
    value.selectionWeight <= 0 ||
    macroHourValue(value.constructionDurationMacroHours) !==
      24 * value.footprintWidth * value.footprintDepth ||
    rotations.length === 0 ||
    new Set(rotations).size !== rotations.length ||
    rotations.some((rotation) => rotation < 0 || rotation > 3) ||
    zoneIds.length === 0 ||
    new Set(zoneIds).size !== zoneIds.length ||
    !Number.isFinite(value.prototypeHeight) ||
    value.prototypeHeight <= 0 ||
    !CAPACITY_PROFILE_ID.test(value.capacityProfileDefinitionId)
  ) {
    throw new RangeError('building-definition:invalid');
  }
  return Object.freeze({
    ...value,
    allowedRotationQuarterTurns: Object.freeze(rotations.sort((a, b) => a - b)),
    compatibleZoneDefinitionIds: Object.freeze(zoneIds.sort()),
  });
}

const VALUES: readonly BuildingDefinition[] = Object.freeze([
  definition({
    id: 'residential-cottage-1x1',
    version: 1,
    label: 'Cottage',
    footprintWidth: 1,
    footprintDepth: 1,
    allowedRotationQuarterTurns: ALL_ROTATIONS,
    compatibleZoneDefinitionIds: Object.freeze(['residential']),
    selectionPriority: 10,
    selectionWeight: 40,
    constructionDurationMacroHours: macroHourDuration(24),
    prototypeId: 'cottage',
    prototypeHeight: 0.8,
    capacityProfileDefinitionId: 'capacity.residential.cottage.v1',
  }),
  definition({
    id: 'residential-rowhouse-1x2',
    version: 1,
    label: 'Row House',
    footprintWidth: 1,
    footprintDepth: 2,
    allowedRotationQuarterTurns: ALL_ROTATIONS,
    compatibleZoneDefinitionIds: Object.freeze(['residential']),
    selectionPriority: 20,
    selectionWeight: 30,
    constructionDurationMacroHours: macroHourDuration(48),
    prototypeId: 'rowhouse',
    prototypeHeight: 1.25,
    capacityProfileDefinitionId: 'capacity.residential.rowhouse.v1',
  }),
  definition({
    id: 'residential-duplex-2x1',
    version: 1,
    label: 'Duplex',
    footprintWidth: 2,
    footprintDepth: 1,
    allowedRotationQuarterTurns: ALL_ROTATIONS,
    compatibleZoneDefinitionIds: Object.freeze(['residential']),
    selectionPriority: 20,
    selectionWeight: 20,
    constructionDurationMacroHours: macroHourDuration(48),
    prototypeId: 'duplex',
    prototypeHeight: 1.1,
    capacityProfileDefinitionId: 'capacity.residential.duplex.v1',
  }),
  definition({
    id: 'residential-apartment-2x2',
    version: 1,
    label: 'Apartment',
    footprintWidth: 2,
    footprintDepth: 2,
    allowedRotationQuarterTurns: ALL_ROTATIONS,
    compatibleZoneDefinitionIds: Object.freeze(['residential']),
    selectionPriority: 30,
    selectionWeight: 10,
    constructionDurationMacroHours: macroHourDuration(96),
    prototypeId: 'apartment',
    prototypeHeight: 2.4,
    capacityProfileDefinitionId: 'capacity.residential.apartment.v1',
  }),
  definition({
    id: 'commercial-shop-1x1',
    version: 1,
    label: 'Corner Shop',
    footprintWidth: 1,
    footprintDepth: 1,
    allowedRotationQuarterTurns: ALL_ROTATIONS,
    compatibleZoneDefinitionIds: Object.freeze(['commercial']),
    selectionPriority: 10,
    selectionWeight: 40,
    constructionDurationMacroHours: macroHourDuration(24),
    prototypeId: 'shop',
    prototypeHeight: 0.9,
    capacityProfileDefinitionId: 'capacity.commercial.shop.v1',
  }),
  definition({
    id: 'commercial-cafe-1x1',
    version: 1,
    label: 'Cafe',
    footprintWidth: 1,
    footprintDepth: 1,
    allowedRotationQuarterTurns: ALL_ROTATIONS,
    compatibleZoneDefinitionIds: Object.freeze(['commercial']),
    selectionPriority: 10,
    selectionWeight: 30,
    constructionDurationMacroHours: macroHourDuration(24),
    prototypeId: 'cafe',
    prototypeHeight: 0.85,
    capacityProfileDefinitionId: 'capacity.commercial.cafe.v1',
  }),
  definition({
    id: 'commercial-market-1x2',
    version: 1,
    label: 'Market',
    footprintWidth: 1,
    footprintDepth: 2,
    allowedRotationQuarterTurns: ALL_ROTATIONS,
    compatibleZoneDefinitionIds: Object.freeze(['commercial']),
    selectionPriority: 20,
    selectionWeight: 20,
    constructionDurationMacroHours: macroHourDuration(48),
    prototypeId: 'market',
    prototypeHeight: 1.2,
    capacityProfileDefinitionId: 'capacity.commercial.market.v1',
  }),
  definition({
    id: 'commercial-office-2x2',
    version: 1,
    label: 'Office',
    footprintWidth: 2,
    footprintDepth: 2,
    allowedRotationQuarterTurns: ALL_ROTATIONS,
    compatibleZoneDefinitionIds: Object.freeze(['commercial']),
    selectionPriority: 30,
    selectionWeight: 10,
    constructionDurationMacroHours: macroHourDuration(96),
    prototypeId: 'office',
    prototypeHeight: 2.1,
    capacityProfileDefinitionId: 'capacity.commercial.office.v1',
  }),
  definition({
    id: 'industrial-workshop-1x2',
    version: 1,
    label: 'Workshop',
    footprintWidth: 1,
    footprintDepth: 2,
    allowedRotationQuarterTurns: ALL_ROTATIONS,
    compatibleZoneDefinitionIds: Object.freeze(['industrial']),
    selectionPriority: 20,
    selectionWeight: 35,
    constructionDurationMacroHours: macroHourDuration(48),
    prototypeId: 'workshop',
    prototypeHeight: 1.05,
    capacityProfileDefinitionId: 'capacity.industrial.workshop.v1',
  }),
  definition({
    id: 'industrial-depot-1x1',
    version: 1,
    label: 'Depot',
    footprintWidth: 1,
    footprintDepth: 1,
    allowedRotationQuarterTurns: ALL_ROTATIONS,
    compatibleZoneDefinitionIds: Object.freeze(['industrial']),
    selectionPriority: 10,
    selectionWeight: 30,
    constructionDurationMacroHours: macroHourDuration(24),
    prototypeId: 'depot',
    prototypeHeight: 0.75,
    capacityProfileDefinitionId: 'capacity.industrial.depot.v1',
  }),
  definition({
    id: 'industrial-warehouse-2x2',
    version: 1,
    label: 'Warehouse',
    footprintWidth: 2,
    footprintDepth: 2,
    allowedRotationQuarterTurns: ALL_ROTATIONS,
    compatibleZoneDefinitionIds: Object.freeze(['industrial']),
    selectionPriority: 30,
    selectionWeight: 20,
    constructionDurationMacroHours: macroHourDuration(96),
    prototypeId: 'warehouse',
    prototypeHeight: 1.35,
    capacityProfileDefinitionId: 'capacity.industrial.warehouse.v1',
  }),
  definition({
    id: 'industrial-factory-2x2',
    version: 1,
    label: 'Factory',
    footprintWidth: 2,
    footprintDepth: 2,
    allowedRotationQuarterTurns: ALL_ROTATIONS,
    compatibleZoneDefinitionIds: Object.freeze(['industrial']),
    selectionPriority: 30,
    selectionWeight: 15,
    constructionDurationMacroHours: macroHourDuration(96),
    prototypeId: 'factory',
    prototypeHeight: 1.8,
    capacityProfileDefinitionId: 'capacity.industrial.factory.v1',
  }),
]);

const BY_ID = new Map<BuildingDefinitionId, BuildingDefinition>(
  VALUES.map((value) => [value.id, value]),
);
export const RESIDENTIAL_COTTAGE_1X1 = VALUES[0] as BuildingDefinition;
export const RESIDENTIAL_ROWHOUSE_1X2 = VALUES[1] as BuildingDefinition;
export const COMMERCIAL_SHOP_1X1 = VALUES[4] as BuildingDefinition;
export const COMMERCIAL_OFFICE_2X2 = VALUES[7] as BuildingDefinition;
export const INDUSTRIAL_WORKSHOP_1X2 = VALUES[8] as BuildingDefinition;
export const INDUSTRIAL_WAREHOUSE_2X2 = VALUES[10] as BuildingDefinition;
export function buildingDefinitions(): readonly BuildingDefinition[] {
  return VALUES;
}
export function buildingDefinitionForId(id: BuildingDefinitionId): BuildingDefinition {
  const found = BY_ID.get(id);
  if (found === undefined) throw new RangeError('building-definition:unknown-id');
  return found;
}
