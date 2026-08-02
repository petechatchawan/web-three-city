import { describe, expect, it } from 'vitest';
import { messageForGameReason, type GameOperationReason } from './game-reason-catalog.js';

const EXPECTED_MESSAGES = {
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
  'road:invalid-state': 'The road network is unavailable; try again',
  'road:invalid-cell': 'Move the road inside the map',
  'road:incoherent-world-revision': 'The world changed; try again',
  'road:no-change': 'No road change',
  'road:unsupported-terrain': 'Roads require flat terrain or a supported straight ramp',
  'road:wet-cell': 'Roads cannot be placed on water',
  'road:invalid-ramp-topology': 'Roads on ramps must continue straight along the slope',
  'road:zone-occupied': 'Remove the zone before building a road here',
  'road:zone-access-lost': 'This road is required by an existing zone',
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
} satisfies Readonly<Record<GameOperationReason, string>>;

describe('messageForGameReason', () => {
  it.each(Object.entries(EXPECTED_MESSAGES) as [GameOperationReason, string][])(
    'maps %s to stable product copy',
    (reason, expected) => {
      expect(messageForGameReason(reason)).toBe(expected);
    },
  );

  it('does not expose internal reason codes in product copy', () => {
    for (const [reason, message] of Object.entries(EXPECTED_MESSAGES)) {
      expect(message).not.toContain(reason);
      expect(message).not.toMatch(/revision:\d|chunk|hash/i);
    }
  });
});
