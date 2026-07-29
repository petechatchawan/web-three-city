export { BASIC_ROAD_CODE, EMPTY_ROAD_CODE } from './contracts.js';
export type {
  RoadConnectionMask,
  RoadDefinition,
  RoadDefinitionCode,
  RoadDefinitionId,
  RoadOperation,
  RoadSnapshot,
} from './contracts.js';
export {
  createEmptyRoadSnapshot,
  createRoadSnapshot,
  occupiedRoadCellCount,
  roadDefinitionCodeAt,
  roadOccupiedAt,
} from './road-snapshot.js';
export type { CreateRoadSnapshotInput } from './road-snapshot.js';
