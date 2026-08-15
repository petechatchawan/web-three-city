import { describe, expect, it } from 'vitest';
import { roadPreviewStateLabel } from '../src/game-tool-context-bridge.js';

describe('roadPreviewStateLabel', () => {
  it.each([
    ['road-build', true, 'Valid build'],
    ['road-build', false, 'Invalid build'],
    ['road-bulldoze', true, 'Valid bulldoze'],
    ['road-bulldoze', false, 'Invalid bulldoze'],
    ['road-build', null, 'Tool ready'],
  ] as const)('maps %s / %s to %s', (mode, valid, expected) => {
    expect(roadPreviewStateLabel(mode, valid)).toBe(expected);
  });
});
