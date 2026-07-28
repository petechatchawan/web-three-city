import { WATER_GEOMETRY_EPSILON } from './policy.js';

export interface TriangleVertex {
  readonly x: number;
  readonly z: number;
  readonly level: number;
}

export interface WetVertex {
  readonly x: number;
  readonly z: number;
  readonly terrainLevel: number;
}

export interface WetInterval {
  readonly start: number;
  readonly end: number;
}

export interface WetFragment {
  readonly vertices: readonly WetVertex[];
  readonly area: number;
}

function isWet(level: number, seaLevel: number): boolean {
  return level <= seaLevel;
}

function interpolateToSea(
  from: TriangleVertex,
  to: TriangleVertex,
  seaLevel: number,
): WetVertex {
  const t = (seaLevel - from.level) / (to.level - from.level);
  return Object.freeze({
    x: from.x + (to.x - from.x) * t,
    z: from.z + (to.z - from.z) * t,
    terrainLevel: seaLevel,
  });
}

function toWetVertex(vertex: TriangleVertex): WetVertex {
  return Object.freeze({ x: vertex.x, z: vertex.z, terrainLevel: vertex.level });
}

function samePoint(first: WetVertex, second: WetVertex): boolean {
  return (
    Math.abs(first.x - second.x) <= WATER_GEOMETRY_EPSILON &&
    Math.abs(first.z - second.z) <= WATER_GEOMETRY_EPSILON &&
    Math.abs(first.terrainLevel - second.terrainLevel) <= WATER_GEOMETRY_EPSILON
  );
}

function removeAdjacentDuplicates(vertices: readonly WetVertex[]): readonly WetVertex[] {
  const result: WetVertex[] = [];
  for (const vertex of vertices) {
    const previous = result.at(-1);
    if (previous === undefined || !samePoint(previous, vertex)) result.push(vertex);
  }
  if (result.length > 1 && samePoint(result[0]!, result.at(-1)!)) result.pop();
  return result;
}

function polygonArea(vertices: readonly WetVertex[]): number {
  let twiceSignedArea = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index]!;
    const next = vertices[(index + 1) % vertices.length]!;
    twiceSignedArea += current.x * next.z - next.x * current.z;
  }
  return Math.abs(twiceSignedArea) / 2;
}

export function wetIntervalForEdge(
  levelA: number,
  levelB: number,
  seaLevel: number,
): WetInterval | null {
  const aWet = isWet(levelA, seaLevel);
  const bWet = isWet(levelB, seaLevel);
  if (aWet && bWet) return Object.freeze({ start: 0, end: 1 });
  if (!aWet && !bWet) return null;

  const crossing = (seaLevel - levelA) / (levelB - levelA);
  return aWet
    ? Object.freeze({ start: 0, end: crossing })
    : Object.freeze({ start: crossing, end: 1 });
}

export function clipTriangleToSea(
  triangle: readonly [TriangleVertex, TriangleVertex, TriangleVertex],
  seaLevel: number,
): WetFragment | null {
  let output: WetVertex[] = [];

  for (let index = 0; index < triangle.length; index += 1) {
    const current = triangle[index]!;
    const previous = triangle[(index + triangle.length - 1) % triangle.length]!;
    const currentWet = isWet(current.level, seaLevel);
    const previousWet = isWet(previous.level, seaLevel);

    if (currentWet) {
      if (!previousWet) output.push(interpolateToSea(previous, current, seaLevel));
      output.push(toWetVertex(current));
    } else if (previousWet) {
      output.push(interpolateToSea(previous, current, seaLevel));
    }
  }

  output = [...removeAdjacentDuplicates(output)];
  if (output.length < 3) return null;

  const area = polygonArea(output);
  if (area <= WATER_GEOMETRY_EPSILON) return null;

  return Object.freeze({
    vertices: Object.freeze(output),
    area,
  });
}
