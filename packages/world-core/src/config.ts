export const WORLD_CONFIG = Object.freeze({
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

export type WorldConfig = Readonly<typeof WORLD_CONFIG>;
