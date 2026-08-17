import { describe, expect, it } from 'vitest';
import {
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  type RoadTrafficSourceProjection,
} from '../src/index.js';

const EAST = 1 << 1;
const WEST = 1 << 3;

function roadSource(definitionCodes: readonly number[]): RoadTrafficSourceProjection {
  return Object.freeze({
    roadRevision: 7,
    width: 8,
    height: 8,
    cells: Object.freeze(
      definitionCodes.map((definitionCode, index) =>
        Object.freeze({
          x: index + 1,
          z: 1,
          definitionCode,
          connectionMask:
            definitionCodes.length === 1
              ? 0
              : index === 0
                ? EAST
                : index === definitionCodes.length - 1
                  ? WEST
                  : EAST | WEST,
          elevationStartQ: 0,
          elevationEndQ: 0,
        }),
      ),
    ),
  });
}

describe('Traffic Road definition compatibility', () => {
  it('treats Local, Collector, and Arterial with foundation-equivalent Traffic semantics in PR2', () => {
    const mixedRoadTypes = roadSource([1, 2, 3]);
    const localEquivalent = roadSource([1, 1, 1]);

    expect(deriveVehicleTrafficGraph(mixedRoadTypes)).toEqual(
      deriveVehicleTrafficGraph(localEquivalent),
    );
    expect(derivePedestrianTrafficGraph(mixedRoadTypes)).toEqual(
      derivePedestrianTrafficGraph(localEquivalent),
    );
  });
});
