import { buildingAtCell, buildingDefinitionForId } from '@web-three-city/building-core';
import type { RciDefinitionRegistries } from '@web-three-city/rci-core';
import {
  roadDefinitionCodeAt,
  roadDefinitionForCode,
  roadOccupiedAt,
} from '@web-three-city/road-core';
import { terrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import {
  zoneDefinitionCodeAt,
  zoneDefinitionForCode,
  zoneOccupiedAt,
} from '@web-three-city/zone-core';
import type { CommittedWorld } from '../../application/committed-world.js';
import { createTrafficInspectProjection } from './traffic-inspect-projections.js';
import type { InspectTarget } from './inspect-target.js';

export type InspectProjection = Readonly<{
  kind: InspectTarget['kind'] | 'unavailable';
  title: string;
  fields?: ReadonlyArray<Readonly<{ label: string; value: string }>>;
}>;

function field(label: string, value: string | number): Readonly<{ label: string; value: string }> {
  return Object.freeze({ label, value: String(value) });
}

export function createInspectProjection(
  world: CommittedWorld,
  target: InspectTarget,
  registries: RciDefinitionRegistries,
): InspectProjection {
  if (target.kind === 'citizen' || target.kind === 'vehicle') {
    return createTrafficInspectProjection(world, target);
  }

  const { cell } = target;
  if (target.kind === 'building') {
    const instance = buildingAtCell(world.buildings, cell);
    if (instance === null) return Object.freeze({ kind: 'unavailable', title: 'Unavailable' });
    const definition = buildingDefinitionForId(instance.buildingDefinitionId);
    const capacity = registries.capacityProfiles.get(definition.capacityProfileDefinitionId);
    const capacityLabel =
      capacity.kind === 'residential'
        ? `${capacity.dwellingUnitCount} dwellings`
        : `${capacity.positionGroups.reduce((sum, group) => sum + group.capacity, 0)} workplaces`;
    return Object.freeze({
      kind: 'building',
      title: definition.label,
      fields: Object.freeze([
        field('Zone', definition.compatibleZoneDefinitionIds[0] ?? 'Unknown'),
        field('Capacity', capacityLabel),
        field('Development', instance.lifecycle),
        field(
          'Road access',
          world.environments.building.roadAccessAt(instance.originCell) === null ? 'No' : 'Yes',
        ),
      ]),
    });
  }
  if (target.kind === 'road') {
    if (!roadOccupiedAt(world.roads, cell)) {
      return Object.freeze({ kind: 'unavailable', title: 'Unavailable' });
    }
    const definition = roadDefinitionForCode(roadDefinitionCodeAt(world.roads, cell));
    return Object.freeze({
      kind: 'road',
      title: definition === null ? 'Road' : 'Basic Road',
      fields: Object.freeze([
        field('Cell', `${cell.x}, ${cell.z}`),
        field('Connected', 'Network cell'),
      ]),
    });
  }
  if (target.kind === 'zone') {
    if (!zoneOccupiedAt(world.zones, cell)) {
      return Object.freeze({ kind: 'unavailable', title: 'Unavailable' });
    }
    const definition = zoneDefinitionForCode(zoneDefinitionCodeAt(world.zones, cell));
    return Object.freeze({
      kind: 'zone',
      title: `${definition?.label ?? 'Zone'} Zone`,
      fields: Object.freeze([
        field('Cell', `${cell.x}, ${cell.z}`),
        field(
          'Road adjacency',
          world.environments.building.roadAccessAt(cell) === null ? 'No' : 'Yes',
        ),
        field('Development', buildingAtCell(world.buildings, cell) === null ? 'Open' : 'Developed'),
      ]),
    });
  }
  const surface = terrainCellSurfaceProfile(world.terrain, cell, WORLD_CONFIG);
  const triangle = (cell.z * WORLD_CONFIG.mapWidth + cell.x) * 2;
  const wet =
    world.water.seaTriangleMask[triangle] === 1 || world.water.seaTriangleMask[triangle + 1] === 1;
  return Object.freeze({
    kind: 'terrain',
    title: 'Terrain',
    fields: Object.freeze([
      field('Cell', `${cell.x}, ${cell.z}`),
      field('Height', `${surface.minimumLevel}–${surface.maximumLevel}`),
      field('Water', wet ? 'Wet' : 'Dry'),
      field('Occupancy', 'Open terrain'),
    ]),
  });
}
