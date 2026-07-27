export { WORLD_CONFIG } from './config.js';
export type { WorldConfig } from './config.js';
export {
  assertCellCoord,
  assertGridVertexCoord,
  cellIndex,
  vertexIndex,
  vertexToWorld,
  worldToCell,
} from './coordinates.js';
export type { CellCoord, GridVertexCoord, WorldPoint } from './coordinates.js';
export { WorldContractError } from './errors.js';
export type { WorldContractErrorCode } from './errors.js';
export { err, ok } from './result.js';
export type { Result } from './result.js';
