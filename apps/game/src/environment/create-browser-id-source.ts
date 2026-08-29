import {
  parseCityId,
  type IdSource,
} from "@web-three-city/orchestration-city-session";

export function createBrowserIdSource(
  randomUuid: () => string = () => crypto.randomUUID(),
): IdSource {
  return Object.freeze({
    nextCityId() {
      const parsed = parseCityId(randomUuid());
      if (parsed.status !== "success") {
        throw new Error("Browser UUID source produced an invalid CityId.");
      }
      return parsed.value;
    },
  });
}
