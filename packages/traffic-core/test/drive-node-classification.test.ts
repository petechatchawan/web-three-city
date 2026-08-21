import { describe, expect, it } from 'vitest';
import {
  DriveNodeClassificationCache,
  classifyDriveNode,
  type TrafficGraph,
} from '../src/index.js';

type DirectedEdge = readonly [from: string, to: string];

function graph(revision: number, edges: readonly DirectedEdge[]): TrafficGraph {
  const coordinates: Record<string, readonly [xQ: number, zQ: number]> = {
    north: [0, -1],
    east: [1, 0],
    south: [0, 1],
    west: [-1, 0],
    center: [0, 0],
  };
  const nodeIds = [...new Set(edges.flatMap(([from, to]) => [from, to]))].sort();
  return Object.freeze({
    sourceRoadRevision: revision,
    sourceBuildingRevision: 0,
    nodes: Object.freeze(
      nodeIds.map((nodeId) => {
        const [xQ, zQ] = coordinates[nodeId]!;
        return Object.freeze({ nodeId, xQ, yQ: 0, zQ });
      }),
    ),
    edges: Object.freeze(
      edges.map(([fromNodeId, toNodeId], index) =>
        Object.freeze({
          edgeId: `edge-${index}`,
          fromNodeId,
          toNodeId,
          mode: 'Drive' as const,
          lengthQ: 1,
          freeFlowTravelSeconds: 1,
          capacityUnits: 1,
        }),
      ),
    ),
  });
}

function aroundCenter(edges: readonly DirectedEdge[]): TrafficGraph {
  return graph(7, edges);
}

describe('directed drive-node classification', () => {
  it.each([
    [
      'straight continuation',
      [
        ['west', 'center'],
        ['center', 'east'],
      ],
      'SimpleContinuation',
    ],
    [
      'degree-2 bend',
      [
        ['west', 'center'],
        ['center', 'south'],
      ],
      'SimpleContinuation',
    ],
    [
      'diverge',
      [
        ['west', 'center'],
        ['center', 'north'],
        ['center', 'east'],
      ],
      'Diverge',
    ],
    [
      'pure merge',
      [
        ['north', 'center'],
        ['west', 'center'],
        ['center', 'east'],
      ],
      'Merge',
    ],
    [
      'T junction',
      [
        ['north', 'center'],
        ['west', 'center'],
        ['east', 'center'],
        ['center', 'north'],
        ['center', 'west'],
        ['center', 'east'],
      ],
      'ConflictJunction',
    ],
    [
      'four-way junction',
      [
        ['north', 'center'],
        ['east', 'center'],
        ['south', 'center'],
        ['west', 'center'],
        ['center', 'north'],
        ['center', 'east'],
        ['center', 'south'],
        ['center', 'west'],
      ],
      'ConflictJunction',
    ],
  ] as const)('classifies directed %s without a generic degree queue', (_name, edges, expected) => {
    expect(classifyDriveNode(aroundCenter(edges), 'center')).toMatchObject({
      nodeId: 'center',
      classification: expected,
    });
  });

  it('caches classifications only within a graph revision', () => {
    const cache = new DriveNodeClassificationCache();
    const first = aroundCenter([
      ['west', 'center'],
      ['center', 'east'],
    ]);
    const changedTopology = graph(8, [
      ['north', 'center'],
      ['west', 'center'],
      ['center', 'east'],
    ]);

    const firstClassification = cache.getOrCreate(first, 'center');
    const changedClassification = cache.getOrCreate(changedTopology, 'center');

    expect(firstClassification).not.toBeNull();
    expect(changedClassification).not.toBeNull();
    expect(firstClassification?.classification).toBe('SimpleContinuation');
    expect(changedClassification?.classification).toBe('Merge');
    expect(cache.size).toBe(2);
  });
});
