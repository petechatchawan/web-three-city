export const TERRAIN_GENERATION_PROFILE_ID = "balanced-temperate-generation";
export const TERRAIN_GENERATION_PROFILE_VERSION = 2;
export const TERRAIN_SEED64_PATTERN = /^0x[0-9A-F]{16}$/;
export const TERRAIN_FINGERPRINT_PATTERN = /^0x[0-9A-F]{16}$/;

export function canonicalTerrainSeed64(seed64: string): string | undefined {
  if (!/^0x[0-9a-fA-F]{16}$/.test(seed64)) return undefined;
  return `0x${seed64.slice(2).toUpperCase()}`;
}
