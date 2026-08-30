import type { WorldSpatialRead } from "@web-three-city/world";
import type { Group, Raycaster } from "three";
import type { TerrainSemanticPickResult } from "../../../contracts/terrain-three";
import type { TerrainAuthorityRead } from "../../../contracts/terrain-read";
import { Q16_ONE } from "../../../domain/surface";

export interface TerrainRaycastCandidate {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function toLocalQ16(
  value: number,
  minInclusive: number,
  maxExclusive: number,
): number {
  const span = maxExclusive - minInclusive;
  if (!(span > 0)) {
    throw new Error(
      "World Cell bounds must have a positive presentation span.",
    );
  }
  const normalized = (value - minInclusive) / span;
  const rounded = Math.round(normalized * Q16_ONE);
  return Math.max(0, Math.min(Q16_ONE - 1, rounded));
}

export function resolveSemanticTerrainCandidate(input: {
  readonly candidate: TerrainRaycastCandidate;
  readonly world: WorldSpatialRead;
  readonly terrain: TerrainAuthorityRead;
}): TerrainSemanticPickResult {
  const cellResult = input.world.worldPositionToCell({
    x: input.candidate.x,
    z: input.candidate.z,
  });
  if (cellResult.status !== "success") {
    return { status: "miss", reason: "WORLD_POSITION_OUT_OF_BOUNDS" };
  }

  const boundsResult = input.world.cellBounds(cellResult.value);
  if (boundsResult.status !== "success") {
    throw new Error(
      "World rejected Cell bounds after resolving a valid Terrain pick Cell.",
    );
  }

  const uQ16 = toLocalQ16(
    input.candidate.x,
    boundsResult.value.xMinInclusive,
    boundsResult.value.xMaxExclusive,
  );
  const vQ16 = toLocalQ16(
    input.candidate.z,
    boundsResult.value.zMinInclusive,
    boundsResult.value.zMaxExclusive,
  );
  const sample = input.terrain.sampleSurface(cellResult.value, uQ16, vQ16);

  if (sample.status === "unavailable") {
    return {
      status: "unavailable",
      code: sample.code,
      chunk: sample.chunk,
    };
  }
  if (sample.status !== "success") {
    throw new Error(
      "Terrain rejected a semantic sample after World resolved a valid Terrain pick Cell.",
    );
  }

  return {
    status: "hit",
    value: {
      cell: cellResult.value,
      triangle: sample.value.triangle,
      heightQ16: sample.value.heightQ16,
      riseX: sample.value.riseX,
      riseZ: sample.value.riseZ,
      revision: sample.value.revision,
    },
  };
}

export function pickSemanticTerrain(input: {
  readonly raycaster: Raycaster;
  readonly root: Group;
  readonly world: WorldSpatialRead;
  readonly terrain: TerrainAuthorityRead;
}): TerrainSemanticPickResult {
  const [intersection] = input.raycaster.intersectObject(input.root, true);
  if (intersection === undefined) {
    return { status: "miss", reason: "NO_TERRAIN_INTERSECTION" };
  }

  return resolveSemanticTerrainCandidate({
    candidate: {
      x: intersection.point.x,
      y: intersection.point.y,
      z: intersection.point.z,
    },
    world: input.world,
    terrain: input.terrain,
  });
}
