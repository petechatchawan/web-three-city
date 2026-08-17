export interface PedestrianAppearance {
  readonly bodyVariant: 0 | 1 | 2;
  readonly clothingColor: number;
  readonly accentColor: number;
}

function hashStableText(text: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

const CLOTHING = Object.freeze([0x4f6d8a, 0x7b5e57, 0x596b4f, 0x7a667d, 0x806b48, 0x4f7775]);
const ACCENTS = Object.freeze([0xd6b089, 0xb57f5f, 0xe0bd9a, 0x8c624c]);

export function pedestrianAppearanceForCitizen(citizenId: string): PedestrianAppearance {
  const hash = hashStableText(`pedestrian-v1|${citizenId}`);
  return Object.freeze({
    bodyVariant: (hash % 3) as 0 | 1 | 2,
    clothingColor: CLOTHING[(hash >>> 3) % CLOTHING.length]!,
    accentColor: ACCENTS[(hash >>> 8) % ACCENTS.length]!,
  });
}
