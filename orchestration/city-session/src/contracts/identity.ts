export const CITY_SAVE_SCHEMA_VERSION = 1 as const;
export const CITY_NAME_MAX_LENGTH = 80 as const;

const CITY_ID_MAX_LENGTH = 128;

declare const cityIdBrand: unique symbol;
declare const cityNameBrand: unique symbol;

export type CityId = string & { readonly [cityIdBrand]: true };
export type CityName = string & { readonly [cityNameBrand]: true };

export type CityIdParseResult =
  | { readonly status: "success"; readonly value: CityId }
  | { readonly status: "rejected"; readonly code: "CITY_ID_INVALID" };

export type CityNameParseResult =
  | { readonly status: "success"; readonly value: CityName }
  | {
      readonly status: "rejected";
      readonly code: "CITY_NAME_REQUIRED" | "CITY_NAME_TOO_LONG";
    };

export function parseCityId(value: string): CityIdParseResult {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > CITY_ID_MAX_LENGTH) {
    return Object.freeze({ status: "rejected", code: "CITY_ID_INVALID" });
  }
  return Object.freeze({ status: "success", value: normalized as CityId });
}

export function parseCityName(value: string): CityNameParseResult {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return Object.freeze({ status: "rejected", code: "CITY_NAME_REQUIRED" });
  }
  if (normalized.length > CITY_NAME_MAX_LENGTH) {
    return Object.freeze({ status: "rejected", code: "CITY_NAME_TOO_LONG" });
  }
  return Object.freeze({ status: "success", value: normalized as CityName });
}
