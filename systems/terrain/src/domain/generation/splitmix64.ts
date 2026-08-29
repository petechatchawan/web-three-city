const SPLITMIX64_INCREMENT = 0x9e3779b97f4a7c15n;
const SPLITMIX64_MIX_1 = 0xbf58476d1ce4e5b9n;
const SPLITMIX64_MIX_2 = 0x94d049bb133111ebn;
const LOW_32_MASK = 0xffffffffn;

function u64(value: bigint): bigint {
  return BigInt.asUintN(64, value);
}

function mixSplitMix64(state: bigint): bigint {
  let value = state;
  value = u64((value ^ (value >> 30n)) * SPLITMIX64_MIX_1);
  value = u64((value ^ (value >> 27n)) * SPLITMIX64_MIX_2);
  return u64(value ^ (value >> 31n));
}

export function deriveLayerSeeds(
  seed64: bigint,
  layerCount: number,
): readonly number[] {
  let state = u64(seed64);
  const seeds: number[] = [];

  for (let index = 0; index < layerCount; index += 1) {
    state = u64(state + SPLITMIX64_INCREMENT);
    seeds.push(Number(mixSplitMix64(state) & LOW_32_MASK));
  }

  return seeds;
}
