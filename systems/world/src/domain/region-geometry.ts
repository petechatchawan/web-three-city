import type { CellCoord, RegionId } from "./coordinates";

export interface RegionCellRun {
  readonly z: number;
  readonly xStartInclusive: number;
  readonly xEndExclusive: number;
}

export interface RegionDefinition {
  readonly id: RegionId;
  readonly runs: readonly RegionCellRun[];
}

export type RegionPreparationFailureReason =
  | "geometry"
  | "overlap"
  | "incomplete";

interface RegionPreparationRejected {
  readonly status: "rejected";
  readonly reason: RegionPreparationFailureReason;
  readonly detail: Readonly<Record<string, unknown>>;
}

export type RegionPreparationResult =
  | { readonly status: "success"; readonly value: PreparedRegionIndex }
  | RegionPreparationRejected;

interface NormalizeRunsResultSuccess {
  readonly status: "success";
  readonly value: readonly RegionCellRun[];
}

interface NormalizeRunsResultRejected {
  readonly status: "rejected";
  readonly reason: "geometry";
  readonly detail: Readonly<Record<string, unknown>>;
}

type NormalizeRunsResult =
  | NormalizeRunsResultSuccess
  | NormalizeRunsResultRejected;

interface RegionOwnership {
  readonly ownerByCell: Int16Array;
  readonly cellCounts: Int32Array;
  readonly firstOwnedCell: Int32Array;
  readonly regionIds: readonly RegionId[];
}

interface RegionOwnershipSuccess {
  readonly status: "success";
  readonly value: RegionOwnership;
}

type RegionOwnershipResult = RegionOwnershipSuccess | RegionPreparationRejected;

export interface PreparedRegionIndex {
  readonly regionIds: readonly RegionId[];
  regionAt(cell: CellCoord): RegionId | undefined;
  adjacentRegions(regionId: RegionId): readonly RegionId[] | undefined;
}

function compareRuns(left: RegionCellRun, right: RegionCellRun): number {
  return left.z - right.z || left.xStartInclusive - right.xStartInclusive;
}

function reject(
  reason: RegionPreparationFailureReason,
  detail: Record<string, unknown>,
): RegionPreparationRejected {
  return { status: "rejected", reason, detail: Object.freeze(detail) };
}

function isRunWithinBounds(
  run: RegionCellRun,
  widthCells: number,
  heightCells: number,
): boolean {
  return (
    Number.isInteger(run.z) &&
    Number.isInteger(run.xStartInclusive) &&
    Number.isInteger(run.xEndExclusive) &&
    run.z >= 0 &&
    run.z < heightCells &&
    run.xStartInclusive >= 0 &&
    run.xEndExclusive <= widthCells &&
    run.xStartInclusive < run.xEndExclusive
  );
}

function normalizeRuns(
  region: RegionDefinition,
  widthCells: number,
  heightCells: number,
): NormalizeRunsResult {
  for (const run of region.runs) {
    if (!isRunWithinBounds(run, widthCells, heightCells)) {
      return {
        status: "rejected",
        reason: "geometry",
        detail: Object.freeze({ regionId: region.id, run }),
      };
    }
  }

  const sorted = [...region.runs].sort(compareRuns);
  const normalized: RegionCellRun[] = [];

  for (const run of sorted) {
    const previous = normalized.at(-1);
    if (
      previous?.z === run.z &&
      run.xStartInclusive <= previous.xEndExclusive
    ) {
      normalized[normalized.length - 1] = Object.freeze({
        z: previous.z,
        xStartInclusive: previous.xStartInclusive,
        xEndExclusive: Math.max(previous.xEndExclusive, run.xEndExclusive),
      });
      continue;
    }
    normalized.push(Object.freeze({ ...run }));
  }

  return { status: "success", value: Object.freeze(normalized) };
}

function cellIndex(cell: CellCoord, widthCells: number): number {
  return cell.z * widthCells + cell.x;
}

function cardinalNeighborIndices(
  current: number,
  widthCells: number,
  heightCells: number,
): readonly number[] {
  const x = current % widthCells;
  const z = Math.floor(current / widthCells);
  const neighbors: number[] = [];

  if (z + 1 < heightCells) {
    neighbors.push(current + widthCells);
  }
  if (x + 1 < widthCells) {
    neighbors.push(current + 1);
  }
  if (z > 0) {
    neighbors.push(current - widthCells);
  }
  if (x > 0) {
    neighbors.push(current - 1);
  }

  return neighbors;
}

function isRegionConnected(
  ownerByCell: Int16Array,
  widthCells: number,
  heightCells: number,
  regionIndex: number,
  startIndex: number,
  expectedCount: number,
): boolean {
  if (startIndex < 0 || expectedCount <= 0) {
    return false;
  }

  const discovered = new Uint8Array(ownerByCell.length);
  const queue = new Int32Array(expectedCount);
  let head = 0;
  let tail = 1;
  let visitedCount = 0;

  discovered[startIndex] = 1;
  queue[0] = startIndex;

  while (head < tail) {
    const current = queue[head];
    head += 1;
    if (current === undefined) {
      return false;
    }
    visitedCount += 1;

    for (const neighbor of cardinalNeighborIndices(
      current,
      widthCells,
      heightCells,
    )) {
      if (discovered[neighbor] !== 1 && ownerByCell[neighbor] === regionIndex) {
        discovered[neighbor] = 1;
        queue[tail] = neighbor;
        tail += 1;
      }
    }
  }

  return visitedCount === expectedCount;
}

function addAdjacency(
  adjacency: readonly Set<number>[],
  leftRegion: number,
  rightRegion: number,
): void {
  if (leftRegion < 0 || rightRegion < 0 || leftRegion === rightRegion) {
    return;
  }
  adjacency[leftRegion]?.add(rightRegion);
  adjacency[rightRegion]?.add(leftRegion);
}

function assignRegionRuns(
  regionIndex: number,
  region: RegionDefinition,
  runs: readonly RegionCellRun[],
  widthCells: number,
  ownership: RegionOwnership,
): RegionPreparationRejected | undefined {
  for (const run of runs) {
    for (let x = run.xStartInclusive; x < run.xEndExclusive; x += 1) {
      const index = run.z * widthCells + x;
      const existingOwner = ownership.ownerByCell[index] ?? -1;
      if (existingOwner !== -1) {
        return reject("overlap", {
          cell: { x, z: run.z },
          regionId: region.id,
          existingRegionId: ownership.regionIds[existingOwner],
        });
      }

      ownership.ownerByCell[index] = regionIndex;
      ownership.cellCounts[regionIndex] =
        (ownership.cellCounts[regionIndex] ?? 0) + 1;
      if ((ownership.firstOwnedCell[regionIndex] ?? -1) < 0) {
        ownership.firstOwnedCell[regionIndex] = index;
      }
    }
  }

  return undefined;
}

function buildOwnership(
  regions: readonly RegionDefinition[],
  widthCells: number,
  heightCells: number,
): RegionOwnershipResult {
  const totalCells = widthCells * heightCells;
  const ownerByCell = new Int16Array(totalCells);
  ownerByCell.fill(-1);
  const cellCounts = new Int32Array(regions.length);
  const firstOwnedCell = new Int32Array(regions.length);
  firstOwnedCell.fill(-1);
  const regionIds = Object.freeze(regions.map((region) => region.id));
  const ownership: RegionOwnership = {
    ownerByCell,
    cellCounts,
    firstOwnedCell,
    regionIds,
  };

  for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
    const region = regions[regionIndex];
    if (region === undefined) {
      return reject("geometry", { regionIndex });
    }

    const normalized = normalizeRuns(region, widthCells, heightCells);
    if (normalized.status === "rejected") {
      return normalized;
    }

    const assignmentFailure = assignRegionRuns(
      regionIndex,
      region,
      normalized.value,
      widthCells,
      ownership,
    );
    if (assignmentFailure !== undefined) {
      return assignmentFailure;
    }
  }

  return { status: "success", value: ownership };
}

function firstUnownedCell(
  ownerByCell: Int16Array,
  widthCells: number,
): CellCoord | undefined {
  for (let index = 0; index < ownerByCell.length; index += 1) {
    if ((ownerByCell[index] ?? -1) < 0) {
      return {
        x: index % widthCells,
        z: Math.floor(index / widthCells),
      };
    }
  }
  return undefined;
}

function firstDisconnectedRegion(
  ownership: RegionOwnership,
  widthCells: number,
  heightCells: number,
): RegionId | undefined {
  for (
    let regionIndex = 0;
    regionIndex < ownership.regionIds.length;
    regionIndex += 1
  ) {
    const connected = isRegionConnected(
      ownership.ownerByCell,
      widthCells,
      heightCells,
      regionIndex,
      ownership.firstOwnedCell[regionIndex] ?? -1,
      ownership.cellCounts[regionIndex] ?? 0,
    );
    if (!connected) {
      return ownership.regionIds[regionIndex];
    }
  }
  return undefined;
}

function buildAdjacency(
  ownerByCell: Int16Array,
  regionCount: number,
  widthCells: number,
  heightCells: number,
): readonly Set<number>[] {
  const adjacencySets = Array.from(
    { length: regionCount },
    () => new Set<number>(),
  );

  for (let z = 0; z < heightCells; z += 1) {
    for (let x = 0; x < widthCells; x += 1) {
      const currentIndex = z * widthCells + x;
      const currentRegion = ownerByCell[currentIndex] ?? -1;

      if (x + 1 < widthCells) {
        addAdjacency(
          adjacencySets,
          currentRegion,
          ownerByCell[currentIndex + 1] ?? -1,
        );
      }
      if (z + 1 < heightCells) {
        addAdjacency(
          adjacencySets,
          currentRegion,
          ownerByCell[currentIndex + widthCells] ?? -1,
        );
      }
    }
  }

  return adjacencySets;
}

function freezeAdjacency(
  adjacencySets: readonly Set<number>[],
  regionIds: readonly RegionId[],
): readonly (readonly RegionId[])[] {
  return Object.freeze(
    adjacencySets.map((set) =>
      Object.freeze(
        [...set]
          .sort((left, right) => left - right)
          .map((regionIndex) => regionIds[regionIndex])
          .filter((regionId): regionId is RegionId => regionId !== undefined),
      ),
    ),
  );
}

export function prepareRegionIndex(
  regions: readonly RegionDefinition[],
  widthCells: number,
  heightCells: number,
): RegionPreparationResult {
  const ownershipResult = buildOwnership(regions, widthCells, heightCells);
  if (ownershipResult.status === "rejected") {
    return ownershipResult;
  }

  const ownership = ownershipResult.value;
  const unownedCell = firstUnownedCell(ownership.ownerByCell, widthCells);
  if (unownedCell !== undefined) {
    return reject("incomplete", { cell: unownedCell });
  }

  const disconnectedRegion = firstDisconnectedRegion(
    ownership,
    widthCells,
    heightCells,
  );
  if (disconnectedRegion !== undefined) {
    return reject("geometry", {
      regionId: disconnectedRegion,
      issue: "disconnected",
    });
  }

  const adjacencyByRegion = freezeAdjacency(
    buildAdjacency(
      ownership.ownerByCell,
      regions.length,
      widthCells,
      heightCells,
    ),
    ownership.regionIds,
  );
  const regionIndexById = new Map(
    ownership.regionIds.map((id, index) => [id, index]),
  );

  const value: PreparedRegionIndex = Object.freeze({
    regionIds: ownership.regionIds,
    regionAt(cell: CellCoord): RegionId | undefined {
      const owner = ownership.ownerByCell[cellIndex(cell, widthCells)] ?? -1;
      return owner >= 0 ? ownership.regionIds[owner] : undefined;
    },
    adjacentRegions(regionId: RegionId): readonly RegionId[] | undefined {
      const index = regionIndexById.get(regionId);
      return index === undefined ? undefined : adjacencyByRegion[index];
    },
  });

  return { status: "success", value };
}
