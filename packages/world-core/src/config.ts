export interface WorldConfig {
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly chunkSize: number;
  readonly cellSize: number;
  readonly heightStep: number;
  readonly minHeightLevel: number;
  readonly maxHeightLevel: number;
  readonly seaLevel: number;
  readonly dioramaBaseY: number;
}

export const WORLD_CONFIG: WorldConfig = Object.freeze({
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
