export { WaterContractError } from './errors.js';
export type { WaterError, WaterErrorCode } from './errors.js';
export { OCEAN_POLICY_V1, WATER_GEOMETRY_EPSILON } from './policy.js';
export { clipTriangleToSea, wetIntervalForEdge } from './wet-fragment.js';
export type {
  TriangleVertex,
  WetFragment,
  WetInterval,
  WetVertex,
} from './wet-fragment.js';
