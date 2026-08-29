export {
  CITY_NAME_MAX_LENGTH,
  CITY_SAVE_SCHEMA_VERSION,
  parseCityId,
  parseCityName,
} from "./contracts/identity";

export type {
  CityId,
  CityIdParseResult,
  CityName,
  CityNameParseResult,
} from "./contracts/identity";

export type {
  CityMetadata,
  CitySaveSummary,
  CitySaveV1,
  LiveCitySession,
  NewCityPreview,
  PreparedTerrainHandle,
  TerrainSessionHandle,
} from "./contracts/city-session";

export type {
  CityRepositoryFailureCode,
  CitySessionDependencies,
  CityRepositoryResult,
  CitySaveRepository,
  Clock,
  IdSource,
  LifecyclePortResult,
  TerrainLifecyclePort,
  WorldLifecyclePort,
} from "./contracts/ports";

export { decodeCitySaveV1, summarizeCitySave } from "./contracts/save-codec";

export type {
  CitySaveDecodeResult,
  CitySessionFailureCode,
  CitySessionResult,
  CitySessionService,
  ResumeCityResult,
} from "./contracts/city-session";
