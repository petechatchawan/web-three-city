import {
  ARTERIAL_ROAD_DEFINITION,
  BASIC_ROAD_DEFINITION,
  COLLECTOR_ROAD_DEFINITION,
  ROAD_EAST,
  ROAD_NORTH,
  ROAD_SOUTH,
  ROAD_WEST,
  type RoadCellView,
  type RoadDefinition,
} from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  buildRoadCellMesh,
  buildRoadLaneMarkingMesh,
  buildRoadPresentationCellMesh,
  roadStyleProfileForDefinition,
} from '../src/index.js';

function flatSurface(): TerrainCellSurfaceProfile {
  return Object.freeze({
    cell: Object.freeze({ x: 6, z: 7 }),
    corners: Object.freeze({ nw: 1, ne: 1, sw: 1, se: 1 }),
    shape: 'flat',
    minimumLevel: 1,
    maximumLevel: 1,
    slopeAxis: null,
  });
}

function view(definition: RoadDefinition, connections: number): RoadCellView {
  return Object.freeze({
    cell: Object.freeze({ x: 6, z: 7 }),
    definition,
    connections,
    surface: flatSurface(),
  });
}

function extentAlongX(positions: Float32Array): number {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < positions.length; index += 3) {
    minimum = Math.min(minimum, positions[index]!);
    maximum = Math.max(maximum, positions[index]!);
  }
  return maximum - minimum;
}

describe('Road Lane Presentation v1', () => {
  it('derives distinct presentation profiles from canonical Road definitions', () => {
    expect(roadStyleProfileForDefinition(BASIC_ROAD_DEFINITION)).toMatchObject({
      roadWidth: 0.72,
      centerDividerVisible: true,
    });
    expect(roadStyleProfileForDefinition(COLLECTOR_ROAD_DEFINITION)).toMatchObject({
      roadWidth: 0.82,
      centerDividerVisible: true,
    });
    expect(roadStyleProfileForDefinition(ARTERIAL_ROAD_DEFINITION)).toMatchObject({
      roadWidth: 0.92,
      centerDividerVisible: true,
    });
  });

  it('keeps carriageway surface width derived from the canonical Road definition', () => {
    const local = buildRoadCellMesh(
      view(BASIC_ROAD_DEFINITION, ROAD_NORTH | ROAD_SOUTH),
      WORLD_CONFIG,
    );
    const collector = buildRoadCellMesh(
      view(COLLECTOR_ROAD_DEFINITION, ROAD_NORTH | ROAD_SOUTH),
      WORLD_CONFIG,
    );
    const arterial = buildRoadCellMesh(
      view(ARTERIAL_ROAD_DEFINITION, ROAD_NORTH | ROAD_SOUTH),
      WORLD_CONFIG,
    );

    expect(extentAlongX(local.positions)).toBeCloseTo(0.72, 5);
    expect(extentAlongX(collector.positions)).toBeCloseTo(0.82, 5);
    expect(extentAlongX(arterial.positions)).toBeCloseTo(0.92, 5);
  });

  it('adds a thin semantic center divider on straight two-way Road cells', () => {
    const northSouth = buildRoadLaneMarkingMesh(
      view(BASIC_ROAD_DEFINITION, ROAD_NORTH | ROAD_SOUTH),
      WORLD_CONFIG,
    );
    const eastWest = buildRoadLaneMarkingMesh(
      view(BASIC_ROAD_DEFINITION, ROAD_EAST | ROAD_WEST),
      WORLD_CONFIG,
    );

    expect(northSouth.indices.length).toBeGreaterThan(0);
    expect(eastWest.indices.length).toBeGreaterThan(0);
    expect(extentAlongX(northSouth.positions)).toBeLessThan(0.08);
  });

  it('draws center-divider geometry through every simple orthogonal Road corner', () => {
    const corners = [
      ROAD_NORTH | ROAD_EAST,
      ROAD_EAST | ROAD_SOUTH,
      ROAD_SOUTH | ROAD_WEST,
      ROAD_WEST | ROAD_NORTH,
    ];

    for (const connections of corners) {
      const marking = buildRoadLaneMarkingMesh(
        view(BASIC_ROAD_DEFINITION, connections),
        WORLD_CONFIG,
      );
      expect(marking.indices.length).toBeGreaterThan(0);
    }
  });

  it('suppresses center-divider geometry inside three-way and four-way junction cells', () => {
    const threeWay = buildRoadLaneMarkingMesh(
      view(BASIC_ROAD_DEFINITION, ROAD_NORTH | ROAD_EAST | ROAD_SOUTH),
      WORLD_CONFIG,
    );
    const fourWay = buildRoadLaneMarkingMesh(
      view(BASIC_ROAD_DEFINITION, ROAD_NORTH | ROAD_EAST | ROAD_SOUTH | ROAD_WEST),
      WORLD_CONFIG,
    );

    expect(threeWay.indices.length).toBe(0);
    expect(fourWay.indices.length).toBe(0);
  });

  it('combines carriageway and lane-marking geometry without changing the surface-only contract', () => {
    const roadView = view(BASIC_ROAD_DEFINITION, ROAD_NORTH | ROAD_SOUTH);
    const surface = buildRoadCellMesh(roadView, WORLD_CONFIG);
    const combined = buildRoadPresentationCellMesh(roadView, WORLD_CONFIG);

    expect(combined.indices.length).toBeGreaterThan(surface.indices.length);
    expect(surface.indices.length).toBe(buildRoadCellMesh(roadView, WORLD_CONFIG).indices.length);
  });
});
