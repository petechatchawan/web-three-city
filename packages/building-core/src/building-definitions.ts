import type {
  BuildingDefinition,
  BuildingDefinitionId,
  BuildingRotationQuarterTurns,
} from './contracts.js';

const ALL_ROTATIONS: readonly BuildingRotationQuarterTurns[] = Object.freeze([0, 1, 2, 3]);

function definition(value: BuildingDefinition): BuildingDefinition {
  if (
    !Number.isSafeInteger(value.footprintWidth) ||
    value.footprintWidth <= 0 ||
    !Number.isSafeInteger(value.footprintDepth) ||
    value.footprintDepth <= 0 ||
    value.allowedRotationQuarterTurns.length === 0 ||
    value.compatibleZoneDefinitionIds.length === 0 ||
    !Number.isFinite(value.prototypeHeight) ||
    value.prototypeHeight <= 0
  ) {
    throw new RangeError('building-definition:invalid');
  }
  return Object.freeze({
    ...value,
    allowedRotationQuarterTurns: Object.freeze([...value.allowedRotationQuarterTurns]),
    compatibleZoneDefinitionIds: Object.freeze([...value.compatibleZoneDefinitionIds]),
  });
}

export const RESIDENTIAL_COTTAGE_1X1 = definition({
  id: 'residential-cottage-1x1',
  version: 1,
  label: 'Cottage',
  footprintWidth: 1,
  footprintDepth: 1,
  allowedRotationQuarterTurns: ALL_ROTATIONS,
  compatibleZoneDefinitionIds: Object.freeze(['residential']),
  selectionPriority: 10,
  prototypeId: 'cottage',
  prototypeHeight: 0.8,
});

export const RESIDENTIAL_ROWHOUSE_1X2 = definition({
  id: 'residential-rowhouse-1x2',
  version: 1,
  label: 'Row House',
  footprintWidth: 1,
  footprintDepth: 2,
  allowedRotationQuarterTurns: ALL_ROTATIONS,
  compatibleZoneDefinitionIds: Object.freeze(['residential']),
  selectionPriority: 20,
  prototypeId: 'rowhouse',
  prototypeHeight: 1.25,
});

export const COMMERCIAL_SHOP_1X1 = definition({
  id: 'commercial-shop-1x1',
  version: 1,
  label: 'Corner Shop',
  footprintWidth: 1,
  footprintDepth: 1,
  allowedRotationQuarterTurns: ALL_ROTATIONS,
  compatibleZoneDefinitionIds: Object.freeze(['commercial']),
  selectionPriority: 10,
  prototypeId: 'shop',
  prototypeHeight: 0.9,
});

export const COMMERCIAL_OFFICE_2X2 = definition({
  id: 'commercial-office-2x2',
  version: 1,
  label: 'Office',
  footprintWidth: 2,
  footprintDepth: 2,
  allowedRotationQuarterTurns: ALL_ROTATIONS,
  compatibleZoneDefinitionIds: Object.freeze(['commercial']),
  selectionPriority: 30,
  prototypeId: 'office',
  prototypeHeight: 2.1,
});

export const INDUSTRIAL_WORKSHOP_1X2 = definition({
  id: 'industrial-workshop-1x2',
  version: 1,
  label: 'Workshop',
  footprintWidth: 1,
  footprintDepth: 2,
  allowedRotationQuarterTurns: ALL_ROTATIONS,
  compatibleZoneDefinitionIds: Object.freeze(['industrial']),
  selectionPriority: 20,
  prototypeId: 'workshop',
  prototypeHeight: 1.05,
});

export const INDUSTRIAL_WAREHOUSE_2X2 = definition({
  id: 'industrial-warehouse-2x2',
  version: 1,
  label: 'Warehouse',
  footprintWidth: 2,
  footprintDepth: 2,
  allowedRotationQuarterTurns: ALL_ROTATIONS,
  compatibleZoneDefinitionIds: Object.freeze(['industrial']),
  selectionPriority: 30,
  prototypeId: 'warehouse',
  prototypeHeight: 1.35,
});

const DEFINITIONS: readonly BuildingDefinition[] = Object.freeze([
  RESIDENTIAL_COTTAGE_1X1,
  RESIDENTIAL_ROWHOUSE_1X2,
  COMMERCIAL_SHOP_1X1,
  COMMERCIAL_OFFICE_2X2,
  INDUSTRIAL_WORKSHOP_1X2,
  INDUSTRIAL_WAREHOUSE_2X2,
]);

const BY_ID = new Map<BuildingDefinitionId, BuildingDefinition>(
  DEFINITIONS.map((entry) => [entry.id, entry]),
);

export function buildingDefinitions(): readonly BuildingDefinition[] {
  return DEFINITIONS;
}

export function buildingDefinitionForId(id: BuildingDefinitionId): BuildingDefinition {
  const found = BY_ID.get(id);
  if (found === undefined) throw new RangeError('building-definition:unknown-id');
  return found;
}
