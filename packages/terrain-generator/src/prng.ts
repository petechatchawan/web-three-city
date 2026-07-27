export type XoshiroState = readonly [number, number, number, number];

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function splitMix32(state: number): readonly [number, number] {
  const nextState = (state + 0x9e3779b9) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0;
  return [nextState, (value ^ (value >>> 15)) >>> 0];
}

export function mix32(value: number): number {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d) >>> 0;
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b) >>> 0;
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

export class Xoshiro128StarStar {
  #s0: number;
  #s1: number;
  #s2: number;
  #s3: number;

  private constructor(state: XoshiroState) {
    [this.#s0, this.#s1, this.#s2, this.#s3] = state;
  }

  static initialState(seed: number): XoshiroState {
    let state = seed >>> 0;
    const values: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      const [nextState, value] = splitMix32(state);
      state = nextState;
      values.push(value);
    }
    return [values[0]!, values[1]!, values[2]!, values[3]!];
  }

  static fromSeed(seed: number): Xoshiro128StarStar {
    return new Xoshiro128StarStar(Xoshiro128StarStar.initialState(seed));
  }

  nextUint32(): number {
    const result = Math.imul(rotateLeft(Math.imul(this.#s1, 5) >>> 0, 7), 9) >>> 0;
    const temporary = (this.#s1 << 9) >>> 0;

    this.#s2 = (this.#s2 ^ this.#s0) >>> 0;
    this.#s3 = (this.#s3 ^ this.#s1) >>> 0;
    this.#s1 = (this.#s1 ^ this.#s2) >>> 0;
    this.#s0 = (this.#s0 ^ this.#s3) >>> 0;
    this.#s2 = (this.#s2 ^ temporary) >>> 0;
    this.#s3 = rotateLeft(this.#s3, 11);

    return result;
  }

  nextFloat(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }
}
