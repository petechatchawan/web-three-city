export interface SeedSource {
  nextSeed64(): string;
}

type RandomValues = (target: Uint32Array) => Uint32Array;

const HEX_RADIX = 16;
const HEX_WORD_LENGTH = 8;

function formatWord(value: number): string {
  return value.toString(HEX_RADIX).toUpperCase().padStart(HEX_WORD_LENGTH, "0");
}

export function createBrowserSeedSource(
  randomValues: RandomValues = (target) => crypto.getRandomValues(target),
): SeedSource {
  return Object.freeze({
    nextSeed64(): string {
      const words = randomValues(new Uint32Array(2));
      const high = words[0];
      const low = words[1];
      if (high === undefined || low === undefined) {
        throw new Error(
          "Browser entropy source did not provide two Seed64 words.",
        );
      }
      return `0x${formatWord(high)}${formatWord(low)}`;
    },
  });
}
