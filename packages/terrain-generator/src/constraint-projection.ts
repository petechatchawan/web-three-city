import { err, ok } from '@web-three-city/world-core';
import type { Result } from '@web-three-city/world-core';

export interface ConstraintProjectionError {
  readonly code: 'constraint-unsatisfied';
  readonly maxPasses: number;
}

function lowerHigherEndpoint(levels: Uint8Array, first: number, second: number): boolean {
  const firstLevel = levels[first]!;
  const secondLevel = levels[second]!;
  if (firstLevel > secondLevel + 1) {
    levels[first] = secondLevel + 1;
    return true;
  }
  if (secondLevel > firstLevel + 1) {
    levels[second] = firstLevel + 1;
    return true;
  }
  return false;
}

function hasInvalidDelta(levels: Uint8Array, width: number, height: number): boolean {
  for (let z = 0; z < height; z += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = z * width + x;
      if (x + 1 < width && Math.abs(levels[index]! - levels[index + 1]!) > 1) return true;
      if (z + 1 < height && Math.abs(levels[index]! - levels[index + width]!) > 1) return true;
    }
  }
  return false;
}

export function projectCardinalConstraints(
  input: Uint8Array,
  width: number,
  height: number,
  maxPasses: number,
): Result<Uint8Array, ConstraintProjectionError> {
  if (input.length !== width * height || width <= 0 || height <= 0 || maxPasses <= 0) {
    return err({ code: 'constraint-unsatisfied', maxPasses });
  }

  const levels = input.slice();
  let changedEver = false;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;
    for (let z = 0; z < height; z += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = z * width + x;
        if (x + 1 < width) changed = lowerHigherEndpoint(levels, index, index + 1) || changed;
        if (z + 1 < height) changed = lowerHigherEndpoint(levels, index, index + width) || changed;
      }
    }

    changedEver = changedEver || changed;
    if (!changed) return ok(changedEver ? levels : input);
  }

  return hasInvalidDelta(levels, width, height)
    ? err({ code: 'constraint-unsatisfied', maxPasses })
    : ok(levels);
}
