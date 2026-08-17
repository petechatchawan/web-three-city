import { describe, expect, it } from 'vitest';
import {
  deriveBuildingAccessNodes,
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  fingerprintTrafficGraph,
  reconcileTrafficGraphs,
  type BuildingTrafficAccessProjection,
  type RoadTrafficSourceProjection,
} from '../src/index.js';

const E = 1 << 1;
const W = 1 << 3;

function roads(
  revision: number,
  cells: RoadTrafficSourceProjection['cells'],
): RoadTrafficSourceProjection {
  return Object.freeze({ roadRevision: revision, width: 8, height: 8, cells });
}

function twoRoads(revision = 0): RoadTrafficSourceProjection {
  return roads(revision, [
    Object.freeze({
      x: 1,
      z: 1,
      definitionCode: 1,
      connectionMask: E,
      elevationStartQ: 0,
      elevationEndQ: 0,
    }),
    Object.freeze({
      x: 2,
      z: 1,
      definitionCode: 1,
      connectionMask: W,
      elevationStartQ: 0,
      elevationEndQ: 0,
    }),
  ]);
}

const buildingAccess: BuildingTrafficAccessProjection = Object.freeze({
  buildingRevision: 3,
  accesses: Object.freeze([
    Object.freeze({
      buildingInstanceId: 'building-1',
      frontageRoadX: 1,
      frontageRoadZ: 1,
      frontageDirection: 'N',
      entranceXQ: 12_000,
      entranceYQ: 0,
      entranceZQ: 8_000,
    }),
  ]),
});

describe('Traffic derived graph foundation', () => {
  it('derives deterministic directed vehicle edges independent of source order', () => {
    const source = twoRoads();
    const reversed = roads(0, [...source.cells].reverse());
    const first = deriveVehicleTrafficGraph(source);
    const second = deriveVehicleTrafficGraph(reversed);

    expect(fingerprintTrafficGraph(first)).toBe(fingerprintTrafficGraph(second));
    expect(first.edges).toHaveLength(2);
    expect(first.edges.map((edge) => edge.edgeId)).toEqual(['drive:1,1->2,1', 'drive:2,1->1,1']);
  });

  it('derives pedestrian corridors offset from vehicle center nodes', () => {
    const source = twoRoads();
    const drive = deriveVehicleTrafficGraph(source);
    const walk = derivePedestrianTrafficGraph(source);
    const drivePositions = new Set(drive.nodes.map((node) => `${node.xQ},${node.zQ}`));
    expect(walk.nodes.some((node) => drivePositions.has(`${node.xQ},${node.zQ}`))).toBe(false);
    expect(walk.edges.some((edge) => edge.fromNodeId.startsWith('walk:1,1'))).toBe(true);
  });

  it('maps building access only from accepted frontage', () => {
    const source = twoRoads();
    const drive = { ...deriveVehicleTrafficGraph(source), sourceBuildingRevision: 3 };
    const walk = { ...derivePedestrianTrafficGraph(source), sourceBuildingRevision: 3 };
    const access = deriveBuildingAccessNodes(buildingAccess, drive, walk);
    expect(access).toEqual([
      {
        buildingInstanceId: 'building-1',
        driveAccessNodeId: 'drive:1,1',
        walkAccessNodeId: 'walk:1,1:S',
      },
    ]);
  });

  it('incrementally reconciles one Road edit to the same graph as a full rebuild', () => {
    const beforeSource = twoRoads(0);
    const previousVehicle = {
      ...deriveVehicleTrafficGraph(beforeSource),
      sourceBuildingRevision: 3,
    };
    const previousPedestrian = {
      ...derivePedestrianTrafficGraph(beforeSource),
      sourceBuildingRevision: 3,
    };
    const afterSource = roads(1, [
      Object.freeze({
        x: 1,
        z: 1,
        definitionCode: 1,
        connectionMask: E,
        elevationStartQ: 0,
        elevationEndQ: 0,
      }),
      Object.freeze({
        x: 2,
        z: 1,
        definitionCode: 1,
        connectionMask: E | W,
        elevationStartQ: 0,
        elevationEndQ: 0,
      }),
      Object.freeze({
        x: 3,
        z: 1,
        definitionCode: 1,
        connectionMask: W,
        elevationStartQ: 0,
        elevationEndQ: 0,
      }),
    ]);
    const result = reconcileTrafficGraphs({
      previousVehicleGraph: previousVehicle,
      previousPedestrianGraph: previousPedestrian,
      roads: afterSource,
      buildingAccess,
      dirty: { changedRoadCells: [{ x: 3, z: 1 }], changedBuildingIds: [] },
    });
    const fullVehicle = { ...deriveVehicleTrafficGraph(afterSource), sourceBuildingRevision: 3 };
    const fullPedestrian = {
      ...derivePedestrianTrafficGraph(afterSource),
      sourceBuildingRevision: 3,
    };

    expect(result.fullRebuild).toBe(false);
    expect(fingerprintTrafficGraph(result.vehicleGraph)).toBe(fingerprintTrafficGraph(fullVehicle));
    expect(fingerprintTrafficGraph(result.pedestrianGraph)).toBe(
      fingerprintTrafficGraph(fullPedestrian),
    );
  });
});
