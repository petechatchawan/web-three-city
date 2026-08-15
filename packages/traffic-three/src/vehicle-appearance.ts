export interface VehicleAppearance {
  readonly bodyVariant: 0 | 1 | 2;
  readonly bodyColor: number;
}

function hashStableText(text: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

const BODY_COLORS = Object.freeze([
  0x4e6e81,
  0x7f493f,
  0x4f6750,
  0x76617a,
  0xb7b7b2,
  0x33363b,
  0xb58a42,
]);

export function vehicleAppearanceForTrip(tripId: string, citizenId: string): VehicleAppearance {
  const hash = hashStableText(`vehicle-v1|${citizenId}|${tripId}`);
  return Object.freeze({
    bodyVariant: (hash % 3) as 0 | 1 | 2,
    bodyColor: BODY_COLORS[(hash >>> 4) % BODY_COLORS.length]!,
  });
}
