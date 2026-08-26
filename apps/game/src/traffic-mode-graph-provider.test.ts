import { describe, expect, it, vi } from 'vitest';
import type { RoadTrafficSourceProjection, TrafficGraph } from '@web-three-city/traffic-core';
import { createTrafficModeGraphProvider } from './traffic-mode-graph-provider.js';

function graph(kind: 'vehicle' | 'pedestrian', roadRevision: number): TrafficGraph {
  return Object.freeze({
    sourceRoadRevision: roadRevision,
    sourceBuildingRevision: 0,
    nodes: Object.freeze([]),
    edges: Object.freeze([]),
    kind,
  } as unknown as TrafficGraph);
}

function roads(roadRevision: number): RoadTrafficSourceProjection {
  return Object.freeze({
    roadRevision,
    width: 0,
    height: 0,
    cells: Object.freeze([]),
  });
}

describe('TrafficModeGraphProvider', () => {
  it('shares one prepared mode-graph bundle across authority and quantum consumers', () => {
    const deriveVehicle = vi.fn((source: RoadTrafficSourceProjection) =>
      graph('vehicle', source.roadRevision),
    );
    const derivePedestrian = vi.fn((source: RoadTrafficSourceProjection) =>
      graph('pedestrian', source.roadRevision),
    );
    const provider = createTrafficModeGraphProvider(deriveVehicle, derivePedestrian);
    const source = roads(1);

    const first = provider.get(source, 4);
    const second = provider.get(source, 4);

    expect(second).toBe(first);
    expect(second.combined.sourceBuildingRevision).toBe(4);
    expect(deriveVehicle).toHaveBeenCalledTimes(1);
    expect(derivePedestrian).toHaveBeenCalledTimes(1);
  });

  it('reuses graph topology across building read clones but refreshes provenance', () => {
    const deriveVehicle = vi.fn((source: RoadTrafficSourceProjection) =>
      graph('vehicle', source.roadRevision),
    );
    const derivePedestrian = vi.fn((source: RoadTrafficSourceProjection) =>
      graph('pedestrian', source.roadRevision),
    );
    const provider = createTrafficModeGraphProvider(deriveVehicle, derivePedestrian);
    const source = roads(1);

    const first = provider.get(source, 4);
    const second = provider.get(source, 4);
    const third = provider.get(source, 5);
    const changedRoads = roads(1);
    const fourth = provider.get(changedRoads, 5);

    expect(second).toBe(first);
    expect(third).not.toBe(second);
    expect(third.combined.sourceBuildingRevision).toBe(5);
    expect(fourth).not.toBe(third);
    expect(deriveVehicle).toHaveBeenCalledTimes(2);
    expect(derivePedestrian).toHaveBeenCalledTimes(2);
  });
});
