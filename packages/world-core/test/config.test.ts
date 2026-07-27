import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '../src/config.js';

describe('WORLD_CONFIG', () => {
  it('locks the accepted world constants', () => {
    expect(WORLD_CONFIG).toEqual({
      mapWidth: 128,
      mapHeight: 128,
      chunkSize: 16,
      cellSize: 1,
      heightStep: 0.5,
      minHeightLevel: 0,
      maxHeightLevel: 4,
      seaLevel: 1,
      dioramaBaseY: -1.5,
    });
  });
});
