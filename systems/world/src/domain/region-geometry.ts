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

export type RegionPreparationResult =
  | { readonly status: "success"; readonly value: PreparedRegionIndex }
  | {
      readonly status: "rejected";
      readonly reason: RegionPreparationFailureReason;
      readonly detail: Readonly<Record<string, unknown>>;
    };

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
): RegionPreparationResult {
  return { status: "rejected", reason, detail: Object.freeze(detail) };
}

function normalizeRuns(
  region: RegionDefinition,
  widthCells: number,
  heightCells: number,
): RegionPreparationResult | readonly RegionCellRun[] {
  for (const run of region.runs) {
    if (
      !Number.isInteger(run.z) ||
      !Number.isInteger(run.xStartInclusive) ||
      !Number.isInteger(run.xEndExclusive) ||
      run.z < 0 ||
      run.z >= heightCells ||
      run.xStartInclusive < 0 ||
      run.xEndExclusive > widthCells ||
      run.xStartInclusive >= run.xEndExclusive
    ) {
      return reject("geometry", { regionId: region.id, run });
    }
  }

  const sorted = [...region.runs].sort(compareRuns);
  const normalized: RegionCellRun[] = [];

  for (const run of sorted) {
    const previous = normalized[normalized.length - 1];
    if (
      previous !== undefined &&
      previous.z === run.z &&
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

  return Object.freeze(normalized);
}

function cellIndex(cell: CellCoord, widthCells: number): number {
  return cell.z * widthCells + cell.x;
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

  const visited = new Uint8Array(ownerByCell.length);
  const queue = new Int32Array(expectedCount);
  let head = 0;
  let tail = 0;
  let visitedCount = 0;
  queue[tail] = startIndex;
  tail += 1;

  while (head < tail) {
    const current = queue[head];
    head += 1;
    if (current === undefined || visited[current] === 1) {
      continue;
    }
    visited[current] = 1;
    visitedCount += 1;

    const x = current % widthCells;
    const z = Math.floor(current / widthCells);
    const neighbors = [
      z + 1 < heightCells ? current + widthCells : -1,
      x + 1 < widthCells ? current + 1 : -1,
      z > 0 ? current - widthCells : -1,
      x > 0 ? current - 1 : -1,
    ];

    for (const neighbor of neighbors) {
      if (
        neighbor >= 0 &&
        visited[neighbor] !== 1 &&
        ownerByCell[neighbor] === regionIndex
      ) {
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

export function prepareRegionIndex(
  regions: readonly RegionDefinition[],
  widthCells: number,
  heightCells: number,
): RegionPreparationResult {
  const totalCells = widthCells * heightCells;
  const ownerByCell = new Int16Array(totalCells);
  ownerByCell.fill(-1);
  const cellCounts = new Int32Array(regions.length);
  const firstOwnedCell = new Int32Array(regions.length);
  firstOwnedCell.fill(-1);
  const regionIds = Object.freeze(regions.map((region) => region.id));

  for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
    const region = regions[regionIndex];
    if (region === undefined) {
      return reject("geometry", { regionIndex });
    }
    const normalized = normalizeRuns(region, widthCells, heightCells);
    if (!Array.isArray(normalized)) {
      return normalized;
    }

    for (const run of normalized) {
      for (let x = run.xStartInclusive; x < run.xEndExclusive; x += 1) {
        const index = run.z * widthCells + x;
        const existingOwner = ownerByCell[index] ?? -1;
        if (existingOwner !== -1) {
          return reject("overlap", {
            cell: { x, z: run.z },
            regionId: region.id,
            existingRegionId: regionIds[existingOwner],
          });
        }
        ownerByCell[index] = regionIndex;
        cellCounts[regionIndex] = (cellCounts[regionIndex] ?? 0) + 1;
        if ((firstOwnedCell[regionIndex] ?? -1) < 0) {
          firstOwnedCell[regionIndex] = index;
        }
      }
    }
  }

  for (let index = 0; index < totalCells; index += 1) {
    if ((ownerByCell[index] ?? -1) < 0) {
      return reject("incomplete", {
        cell: { x: index % widthCells, z: Math.floor(index / widthCells) },
      });
    }
  }

  for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
    if (
      !isRegionConnected(
        ownerByCell,
        widthCells,
        heightCells,
        regionIndex,
        firstOwnedCell[regionIndex] ?? -1,
        cellCounts[regionIndex] ?? 0,
      )
    ) {
      return reject("geometry", {
        regionId: regionIds[regionIndex],
        issue: "disconnected",
      });
    }
  }

  const adjacencySets = Array.from(
    { length: regions.length },
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

  const adjacencyByRegion = Object.freeze(
    adjacencySets.map((set) =>
      Object.freeze(
        [...set]
          .sort((left, right) => left - right)
          .map((regionIndex) => regionIds[regionIndex])
          .filter((regionId): regionId is RegionId => regionId !== undefined),
      ),
    ),
  );
  const regionIndexById = new Map(regionIds.map((id, index) => [id, index]));

  const value: PreparedRegionIndex = Object.freeze({
    regionIds,
    regionAt(cell: CellCoord): RegionId | undefined {
      const owner = ownerByCell[cellIndex(cell, widthCells)] ?? -1;
      return owner >= 0 ? regionIds[owner] : undefined;
    },
    adjacentRegions(regionId: RegionId): readonly RegionId[] | undefined {
      const index = regionIndexById.get(regionId);
      return index === undefined ? undefined : adjacencyByRegion[index];
    },
  });

  return { status: "success", value };
}
