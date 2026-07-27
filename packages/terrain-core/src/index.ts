export { HeightLattice, TerrainInvariantError } from './height-lattice.js';
export type { TerrainInvariantErrorCode } from './height-lattice.js';
export { decodeTerrainSaveV1, encodeTerrainSaveV1 } from './serialization.js';
export type { TerrainSaveError, TerrainSaveErrorCode, TerrainSaveV1 } from './serialization.js';
export { createTerrainMap } from './terrain-map.js';
export type {
  CreateTerrainMapInput,
  TerrainMap,
  TerrainSnapshot,
} from './terrain-map.js';
export { validateTerrainInput } from './validation.js';
export type {
  TerrainValidationIssue,
  TerrainValidationIssueCode,
} from './validation.js';
