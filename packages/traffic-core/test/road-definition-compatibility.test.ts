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
  it('keeps Local, Collector, and Arterial mutually connected while preserving PR3 semantics', () => {
    const mixedRoadTypes = roadSource([1, 2, 3]);
    const localEquivalent = roadSource([1, 1, 1]);

    const mixedVehicle = deriveVehicleTrafficGraph(mixedRoadTypes);
    const localVehicle = deriveVehicleTrafficGraph(localEquivalent);
    expect(mixedVehicle.nodes.map((node) => node.nodeId)).toEqual(
      localVehicle.nodes.map((node) => node.nodeId),
    );
    expect(mixedVehicle.edges.map((edge) => edge.edgeId)).toEqual(
      localVehicle.edges.map((edge) => edge.edgeId),
    );
    expect(
      [...new Set(mixedVehicle.edges.map((edge) => edge.capacityUnits))].sort((a, b) => a - b),
    ).toEqual([16, 24]);

    const mixedPedestrian = derivePedestrianTrafficGraph(mixedRoadTypes);
    const localPedestrian = derivePedestrianTrafficGraph(localEquivalent);
    expect(mixedPedestrian.nodes.map((node) => node.nodeId)).toEqual(
      localPedestrian.nodes.map((node) => node.nodeId),
    );
    expect(mixedPedestrian.edges.map((edge) => edge.edgeId)).toEqual(
      localPedestrian.edges.map((edge) => edge.edgeId),
    );
  });
});
