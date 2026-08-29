import type { CitySessionService } from "./contracts/city-session";
import type { CitySessionDependencies } from "./contracts/ports";
import { createCitySessionServiceInternal } from "./application/city-session-service";

function constructCitySessionService(
  dependencies: CitySessionDependencies,
): CitySessionService {
  return createCitySessionServiceInternal(dependencies);
}

export function createCitySessionService(
  dependencies: CitySessionDependencies,
): CitySessionService {
  return constructCitySessionService(dependencies);
}
