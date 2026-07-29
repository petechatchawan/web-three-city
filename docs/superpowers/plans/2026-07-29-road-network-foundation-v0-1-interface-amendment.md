# Road Network Foundation v0.1 — TDD Plan Interface Amendment

**Status:** Normative amendment to `2026-07-29-road-network-foundation-v0-1.md`  
**Reason:** Final plan self-review identified two interfaces that must be explicit before execution: the derived `RoadCellView` API and the single Game-owned Terrain/Water placement-environment adapter.

This amendment does not change product scope, package ownership, task order, or merge gates. It supersedes only the affected interface/file lists below.

## Amendment A — Task 2 Road definition lookup

Task 2 additionally produces:

```ts
export const BASIC_ROAD_DEFINITION: RoadDefinition;

export function roadDefinitionForCode(code: RoadDefinitionCode): RoadDefinition | null;
export function roadDefinitionForId(id: RoadDefinitionId): RoadDefinition;
```

Required behavior:

- code `0` returns `null`;
- code `1` returns the frozen `BASIC_ROAD_DEFINITION`;
- unknown codes are rejected during snapshot construction and decoding;
- unknown IDs throw `RangeError('road-definition:unknown-id')`.

Add assertions to `packages/road-core/test/road-snapshot.test.ts` and include them in Task 2 RED/GREEN verification.

## Amendment B — Task 3 derived Road cell views

Task 3 additionally produces:

```ts
export interface RoadCellView {
  readonly cell: CellCoord;
  readonly definition: RoadDefinition;
  readonly connections: RoadConnectionMask;
  readonly surface: TerrainCellSurfaceProfile;
}

export function roadCellViewAt(
  snapshot: RoadSnapshot,
  cell: CellCoord,
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): RoadCellView | null;

export function occupiedRoadCellViewsInChunk(
  snapshot: RoadSnapshot,
  chunk: ChunkCoord,
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): readonly RoadCellView[];
```

Required behavior:

- empty cells return `null`;
- occupied cells return copied/frozen cell and surface values;
- chunk queries return deterministic `z`, then `x` order;
- the view is derived from current occupancy and environment and is never serialized;
- invalid or incoherent environment revisions throw `RoadContractError` rather than returning a partial view.

Add tests to `packages/road-core/test/connectivity.test.ts`. Task 5 consumes these exact APIs instead of constructing Road views inside `road-three`.

## Amendment C — Task 4 placement-environment adapter

Task 4 file list additionally includes:

- Create: `apps/game/src/road-placement-environment.ts`
- Test: `apps/game/src/road-placement-environment.test.ts`

Task 4 produces:

```ts
export function createRoadPlacementEnvironment(
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  config: WorldConfig,
): RoadPlacementEnvironment;
```

Implementation contract:

```ts
function isDry(cell: CellCoord): boolean {
  const first = triangleIndexFor(cell.x, cell.z, 0, config.mapWidth);
  const second = triangleIndexFor(cell.x, cell.z, 1, config.mapWidth);
  return water.seaTriangleMask[first] === 0 && water.seaTriangleMask[second] === 0;
}
```

The adapter must also:

- reject `water.sourceTerrainRevision !== terrain.revision` with `RangeError('road-environment:incoherent-revision')`;
- reject wrong Terrain/Water dimensions;
- implement `surfaceAt()` exclusively through `terrainCellSurfaceProfile()`;
- defensively capture the supplied snapshots so later variable reassignment in Game composition cannot change the environment's revision or query results.

Required RED tests:

```ts
expect(environment.isDry(dryCell)).toBe(true);
expect(environment.isDry(seaCell)).toBe(false);
expect(() => createRoadPlacementEnvironment(terrainRevision2, waterRevision1, WORLD_CONFIG))
  .toThrow('road-environment:incoherent-revision');
```

Task 4 verification additionally runs:

```bash
pnpm exec vitest run apps/game/src/road-placement-environment.test.ts apps/game/src/world-save.test.ts
```

Task 8 must call this adapter after every successful Terrain/Water replacement and must not duplicate Water-mask interpretation in `game-bootstrap.ts`.

## Corrected self-review result

With this amendment:

- every type consumed by `road-three` is produced by an earlier `road-core` task;
- Road definition lookup is explicit and deterministic;
- Water dryness has exactly one application-owned adapter;
- world decode and live Game composition use identical placement facts;
- no package-boundary or product-scope change is introduced.
