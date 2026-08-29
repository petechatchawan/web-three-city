import type { CitySessionFailureCode } from "@web-three-city/orchestration-city-session";

const MESSAGES: Readonly<Record<CitySessionFailureCode, string>> =
  Object.freeze({
    CITY_NAME_REQUIRED: "City name is required.",
    CITY_NAME_TOO_LONG: "City name is too long.",
    CITY_WORLD_PREPARE_FAILED: "World definition could not be prepared.",
    CITY_TERRAIN_PREPARE_FAILED: "Terrain seed could not be prepared.",
    CITY_NO_ELIGIBLE_START: "This terrain has no eligible starting Region.",
    CITY_STARTING_REGION_NOT_ELIGIBLE:
      "The selected starting Region is not eligible.",
    CITY_WORLD_CREATE_FAILED: "World creation failed.",
    CITY_TERRAIN_CREATE_FAILED: "Terrain creation failed.",
    CITY_PERSISTENCE_FAILED: "City save storage is unavailable.",
    CITY_SAVE_NOT_FOUND: "The selected city save no longer exists.",
    CITY_SAVE_INVALID: "The selected city save is invalid or corrupted.",
    CITY_WORLD_RESTORE_FAILED: "World state could not be restored.",
    CITY_TERRAIN_RESTORE_FAILED: "Terrain state could not be restored.",
  });

export function citySessionErrorMessage(code: CitySessionFailureCode): string {
  return MESSAGES[code];
}
