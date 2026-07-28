import { describe, expect, it } from 'vitest';
import { clipTriangleToSea, wetIntervalForEdge } from '../src/index.js';

describe('wetIntervalForEdge', () => {
  it.each([
    [0, 0, { start: 0, end: 1 }],
    [2, 2, null],
    [0, 2, { start: 0, end: 0.5 }],
    [2, 0, { start: 0.5, end: 1 }],
    [1, 2, { start: 0, end: 0 }],
  ] as const)('clips edge levels %s → %s', (a, b, expected) => {
    expect(wetIntervalForEdge(a, b, 1)).toEqual(expected);
  });
});

it('creates a deterministic positive-area quad', () => {
  const fragment = clipTriangleToSea(
    [
      { x: 0, z: 1, level: 0 },
      { x: 1, z: 1, level: 2 },
      { x: 1, z: 0, level: 0 },
    ],
    1,
  );

  expect(fragment?.vertices).toEqual([
    { x: 0, z: 1, terrainLevel: 0 },
    { x: 0.5, z: 1, terrainLevel: 1 },
    { x: 1, z: 0.5, terrainLevel: 1 },
    { x: 1, z: 0, terrainLevel: 0 },
  ]);
  expect(fragment?.area).toBeCloseTo(0.375, 8);
});

it('drops point-only sea contact', () => {
  expect(
    clipTriangleToSea(
      [
        { x: 0, z: 0, level: 1 },
        { x: 1, z: 0, level: 2 },
        { x: 0, z: 1, level: 2 },
      ],
      1,
    ),
  ).toBeNull();
});
