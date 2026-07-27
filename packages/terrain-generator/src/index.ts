export { COASTAL_V1 } from './coastal-config.js';
export { generateCoastalTerrain } from './coastal-generator.js';
export type {
  GenerateCoastalTerrainInput,
  TerrainGenerationError,
  TerrainGenerationErrorCode,
} from './coastal-generator.js';
export { createCoastProfile, createInitialCoastalLevels } from './coastal-fields.js';
export { projectCardinalConstraints } from './constraint-projection.js';
export type { ConstraintProjectionError } from './constraint-projection.js';
export { mix32, Xoshiro128StarStar } from './prng.js';
export type { XoshiroState } from './prng.js';
export { calculateTerrainStatistics } from './statistics.js';
export type { TerrainStatistics } from './statistics.js';
