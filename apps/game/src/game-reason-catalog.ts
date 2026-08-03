import type { BuildingInvalidReason } from '@web-three-city/building-core';
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
