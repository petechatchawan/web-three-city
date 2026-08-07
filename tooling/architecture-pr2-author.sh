#!/usr/bin/env bash
set -euo pipefail

git config user.name 'architecture-impl-agent'
git config user.email 'architecture-impl-agent@users.noreply.github.com'
pnpm install --frozen-lockfile
mkdir -p apps/game/src/application

cat > apps/game/src/application/committed-world.test.ts <<'EOF'
import { createEmptyBuildingSnapshot } from '@web-three-city/building-core';
import { createInitialRciSnapshot } from '@web-three-city/rci-core';
import { createEmptyRoadSnapshot, type RoadSnapshot } from '@web-three-city/road-core';
import { createInitialSimulationSnapshot } from '@web-three-city/simulation-core';
import { createTerrainMap } from '@web-three-city/terrain-core';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createEmptyZoneSnapshot, type ZoneSnapshot } from '@web-three-city/zone-core';
import { describe, expect, it } from 'vitest';
import { createBuildingDevelopmentEnvironment } from '../building-development-environment.js';
import { createBuildingWorldOccupancy } from '../building-world-occupancy.js';
import { createRoadPlacementEnvironment } from '../road-placement-environment.js';
import { createZonePlacementEnvironment } from '../zone-placement-environment.js';
import {
  CommittedWorldStore,
  createCommittedWorld,
  type CommittedWorldInput,
} from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';

function sourceWorld(revision = 0): CommittedWorldInput {
  const terrain = createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array(
      (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1),
    ).fill(WORLD_CONFIG.seaLevel + 1),
    seed: 17,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 0,
  });
  const waterResult = deriveWaterSnapshot(terrain, WORLD_CONFIG);
  if (!waterResult.ok) throw new Error(waterResult.error.code);
  const roadSnapshot = createEmptyRoadSnapshot(WORLD_CONFIG);
  const roads: RoadSnapshot = {
    width: roadSnapshot.width,
    height: roadSnapshot.height,
    revision: roadSnapshot.revision,
    definitionCodes: roadSnapshot.definitionCodes,
  };
  const zoneSnapshot = createEmptyZoneSnapshot(WORLD_CONFIG);
  const zones: ZoneSnapshot = {
    width: zoneSnapshot.width,
    height: zoneSnapshot.height,
    revision: zoneSnapshot.revision,
    definitionCodes: zoneSnapshot.definitionCodes,
  };
  const buildings = createEmptyBuildingSnapshot(WORLD_CONFIG);
  const simulation = createInitialSimulationSnapshot();
  const rci = createInitialRciSnapshot({ absoluteTick: simulation.absoluteTick });
  const environments = Object.freeze({
    road: createRoadPlacementEnvironment(terrain, waterResult.value, WORLD_CONFIG),
    zone: createZonePlacementEnvironment(
      terrain,
      waterResult.value,
      roads,
      createBuildingWorldOccupancy(buildings),
      WORLD_CONFIG,
    ),
    building: createBuildingDevelopmentEnvironment(
      terrain,
      waterResult.value,
      roads,
      zones,
      WORLD_CONFIG,
    ),
  });
  return {
    revision,
    terrain,
    water: waterResult.value,
    roads,
    zones,
    buildings,
    simulation,
    rci,
    environments,
  };
}

describe('CommittedWorldStore', () => {
  it('publishes all domain snapshots and derived environments in one application revision', () => {
    const initial = createCommittedWorld(sourceWorld(0));
    const store = new CommittedWorldStore(initial);
    const next = createCommittedWorld(sourceWorld(1));
    const committed = store.replace(0, next);
    expect(committed.revision).toBe(1);
    expect(committed.terrain).toEqual(next.terrain);
    expect(committed.water).toEqual(next.water);
    expect(committed.roads).toEqual(next.roads);
    expect(committed.zones).toEqual(next.zones);
    expect(committed.buildings).toEqual(next.buildings);
    expect(committed.simulation).toEqual(next.simulation);
    expect(committed.rci).toEqual(next.rci);
    expect(committed.water.sourceTerrainRevision).toBe(committed.terrain.revision);
    expect(committed.environments.road.terrainRevision).toBe(committed.terrain.revision);
    expect(committed.environments.zone.roadRevision).toBe(committed.roads.revision);
    expect(committed.environments.zone.occupancyRevision).toBe(committed.buildings.revision);
    expect(committed.environments.building.zoneRevision).toBe(committed.zones.revision);
  });

  it('rejects stale or skipped application revisions without changing committed state', () => {
    const initial = createCommittedWorld(sourceWorld(0));
    const store = new CommittedWorldStore(initial);
    const before = store.snapshot();
    expect(() => store.replace(1, createCommittedWorld(sourceWorld(1)))).toThrow(
      'committed-world:stale-revision',
    );
    expect(() => store.replace(0, createCommittedWorld(sourceWorld(2)))).toThrow(
      'committed-world:invalid-next-revision',
    );
    expect(store.snapshot()).toEqual(before);
  });

  it('copies authoritative typed arrays on publication and on read', () => {
    const source = sourceWorld(0);
    const terrainBefore = source.terrain.heightLevels[0]!;
    const waterBefore = source.water.seaTriangleMask[0]!;
    const roadBefore = source.roads.definitionCodes[0]!;
    const zoneBefore = source.zones.definitionCodes[0]!;
    const store = new CommittedWorldStore(source);
    source.terrain.heightLevels[0] = terrainBefore + 1;
    source.water.seaTriangleMask[0] = waterBefore === 0 ? 1 : 0;
    source.roads.definitionCodes[0] = roadBefore === 0 ? 1 : 0;
    source.zones.definitionCodes[0] = zoneBefore === 0 ? 1 : 0;
    expect(store.snapshot().terrain.heightLevels[0]).toBe(terrainBefore);
    expect(store.snapshot().water.seaTriangleMask[0]).toBe(waterBefore);
    expect(store.snapshot().roads.definitionCodes[0]).toBe(roadBefore);
    expect(store.snapshot().zones.definitionCodes[0]).toBe(zoneBefore);
    const exposed = store.snapshot();
    exposed.terrain.heightLevels[0] = terrainBefore + 2;
    exposed.water.seaTriangleMask[0] = waterBefore === 0 ? 1 : 0;
    exposed.roads.definitionCodes[0] = roadBefore === 0 ? 1 : 0;
    exposed.zones.definitionCodes[0] = zoneBefore === 0 ? 1 : 0;
    expect(store.snapshot().terrain.heightLevels[0]).toBe(terrainBefore);
    expect(store.snapshot().water.seaTriangleMask[0]).toBe(waterBefore);
    expect(store.snapshot().roads.definitionCodes[0]).toBe(roadBefore);
    expect(store.snapshot().zones.definitionCodes[0]).toBe(zoneBefore);
  });

  it('rejects candidate environment provenance that does not match candidate snapshots', () => {
    const input = sourceWorld(0);
    const invalid = {
      ...input,
      environments: {
        ...input.environments,
        road: Object.freeze({ ...input.environments.road, terrainRevision: input.terrain.revision + 1 }),
      },
    };
    expect(() => createCommittedWorld(invalid)).toThrow(
      'committed-world:invalid-environment-provenance',
    );
  });

  it('fingerprints domain content and environment provenance rather than function identity', () => {
    const store = new CommittedWorldStore(createCommittedWorld(sourceWorld(0)));
    const first = store.snapshot();
    const second = store.snapshot();
    expect(fingerprintCommittedWorld(first)).toBe(fingerprintCommittedWorld(second));
    second.terrain.heightLevels[0] = (second.terrain.heightLevels[0] ?? 0) + 1;
    expect(fingerprintCommittedWorld(second)).not.toBe(fingerprintCommittedWorld(first));
  });
});
EOF

set +e
RED_OUTPUT=$(pnpm --filter @web-three-city/game test -- src/application/committed-world.test.ts 2>&1)
RED_STATUS=$?
set -e
if [ "$RED_STATUS" -eq 0 ]; then echo 'Expected RED failure before implementation.' >&2; exit 1; fi
printf '%s\n' "$RED_OUTPUT"
if ! printf '%s\n' "$RED_OUTPUT" | grep -Eq 'committed-world|Failed to resolve import|Cannot find module'; then echo 'RED failed for an unexpected reason.' >&2; exit 1; fi

cat > apps/game/src/application/committed-world.ts <<'EOF'
import { createBuildingSnapshot, type BuildingDevelopmentEnvironment, type BuildingSnapshot } from '@web-three-city/building-core';
import { createRoadSnapshot, type RoadPlacementEnvironment, type RoadSnapshot } from '@web-three-city/road-core';
import type { RciSnapshot } from '@web-three-city/rci-core';
import { createSimulationSnapshot, type SimulationSnapshot } from '@web-three-city/simulation-core';
import { createTerrainMap, type TerrainSnapshot } from '@web-three-city/terrain-core';
import type { WaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createZoneSnapshot, type ZonePlacementEnvironment, type ZoneSnapshot } from '@web-three-city/zone-core';
import { createBuildingDevelopmentEnvironment } from '../building-development-environment.js';
import { createBuildingWorldOccupancy } from '../building-world-occupancy.js';
import { createRoadPlacementEnvironment } from '../road-placement-environment.js';
import { createZonePlacementEnvironment } from '../zone-placement-environment.js';

export interface CommittedWorld {
  readonly revision: number;
  readonly terrain: TerrainSnapshot;
  readonly water: WaterSnapshot;
  readonly roads: RoadSnapshot;
  readonly zones: ZoneSnapshot;
  readonly buildings: BuildingSnapshot;
  readonly simulation: SimulationSnapshot;
  readonly rci: RciSnapshot;
  readonly environments: Readonly<{
    readonly road: RoadPlacementEnvironment;
    readonly zone: ZonePlacementEnvironment;
    readonly building: BuildingDevelopmentEnvironment;
  }>;
}

export type CommittedWorldInput = Readonly<{
  revision: number;
  terrain: TerrainSnapshot;
  water: WaterSnapshot;
  roads: RoadSnapshot;
  zones: ZoneSnapshot;
  buildings: BuildingSnapshot;
  simulation: SimulationSnapshot;
  rci: RciSnapshot;
  environments: CommittedWorld['environments'];
}>;

function assertApplicationRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new RangeError('committed-world:invalid-revision');
}

function assertEnvironmentProvenance(input: CommittedWorldInput): void {
  const { terrain, water, roads, zones, buildings, environments } = input;
  const coherent =
    water.sourceTerrainRevision === terrain.revision &&
    water.sourceTerrainSeed === terrain.seed &&
    environments.road.terrainRevision === terrain.revision &&
    environments.road.waterSourceTerrainRevision === water.sourceTerrainRevision &&
    environments.zone.terrainRevision === terrain.revision &&
    environments.zone.waterSourceTerrainRevision === water.sourceTerrainRevision &&
    environments.zone.roadRevision === roads.revision &&
    environments.zone.occupancyRevision === buildings.revision &&
    environments.building.terrainRevision === terrain.revision &&
    environments.building.waterSourceTerrainRevision === water.sourceTerrainRevision &&
    environments.building.roadRevision === roads.revision &&
    environments.building.zoneRevision === zones.revision;
  if (!coherent) throw new RangeError('committed-world:invalid-environment-provenance');
}

function cloneWaterSnapshot(input: WaterSnapshot): WaterSnapshot {
  if (input.width !== WORLD_CONFIG.mapWidth || input.height !== WORLD_CONFIG.mapHeight) {
    throw new RangeError('committed-world:invalid-water-dimensions');
  }
  return Object.freeze({
    schemaVersion: input.schemaVersion,
    policyVersion: input.policyVersion,
    width: input.width,
    height: input.height,
    seaLevel: input.seaLevel,
    sourceTerrainRevision: input.sourceTerrainRevision,
    sourceTerrainSeed: input.sourceTerrainSeed,
    seaTriangleMask: input.seaTriangleMask.slice(),
    seaTriangleCount: input.seaTriangleCount,
    enclosedWetTriangleCount: input.enclosedWetTriangleCount,
    shorelineSegmentCount: input.shorelineSegmentCount,
  });
}

function cloneForRead(world: CommittedWorld): CommittedWorld {
  return Object.freeze({
    ...world,
    terrain: Object.freeze({ ...world.terrain, heightLevels: world.terrain.heightLevels.slice() }),
    water: Object.freeze({ ...world.water, seaTriangleMask: world.water.seaTriangleMask.slice() }),
    roads: Object.freeze({ width: world.roads.width, height: world.roads.height, revision: world.roads.revision, definitionCodes: world.roads.definitionCodes.slice() }),
    zones: Object.freeze({ width: world.zones.width, height: world.zones.height, revision: world.zones.revision, definitionCodes: world.zones.definitionCodes.slice() }),
  });
}

export function createCommittedWorld(input: CommittedWorldInput): CommittedWorld {
  assertApplicationRevision(input.revision);
  assertEnvironmentProvenance(input);
  const terrain = createTerrainMap({ config: WORLD_CONFIG, heightLevels: input.terrain.heightLevels, seed: input.terrain.seed, generatorVersion: input.terrain.generatorVersion, generationAttempt: input.terrain.generationAttempt, revision: input.terrain.revision });
  const water = cloneWaterSnapshot(input.water);
  const roads = createRoadSnapshot({ width: input.roads.width, height: input.roads.height, revision: input.roads.revision, definitionCodes: input.roads.definitionCodes }, WORLD_CONFIG);
  const zones = createZoneSnapshot({ width: input.zones.width, height: input.zones.height, revision: input.zones.revision, definitionCodes: input.zones.definitionCodes }, WORLD_CONFIG);
  const buildings = createBuildingSnapshot({ revision: input.buildings.revision, instances: input.buildings.instances }, WORLD_CONFIG);
  const simulation = createSimulationSnapshot(input.simulation);
  const environments = Object.freeze({
    road: createRoadPlacementEnvironment(terrain, water, WORLD_CONFIG),
    zone: createZonePlacementEnvironment(terrain, water, roads, createBuildingWorldOccupancy(buildings), WORLD_CONFIG),
    building: createBuildingDevelopmentEnvironment(terrain, water, roads, zones, WORLD_CONFIG),
  });
  return Object.freeze({ revision: input.revision, terrain, water, roads, zones, buildings, simulation, rci: input.rci, environments });
}

export class CommittedWorldStore {
  #world: CommittedWorld;
  constructor(initialWorld: CommittedWorldInput) { this.#world = createCommittedWorld(initialWorld); }
  snapshot(): CommittedWorld { return cloneForRead(this.#world); }
  replace(expectedRevision: number, next: CommittedWorldInput): CommittedWorld {
    if (expectedRevision !== this.#world.revision) throw new Error('committed-world:stale-revision');
    if (next.revision !== this.#world.revision + 1) throw new Error('committed-world:invalid-next-revision');
    this.#world = createCommittedWorld(next);
    return this.snapshot();
  }
}
EOF

cat > apps/game/src/application/committed-world-fingerprint.ts <<'EOF'
import type { CommittedWorld } from './committed-world.js';

function stableValue(value: unknown): unknown {
  if (value instanceof Uint8Array) return [...value];
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, entry]) => typeof entry !== 'function' && entry !== undefined)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, entry]) => [key, stableValue(entry)]));
  }
  return value;
}

export function fingerprintCommittedWorld(world: CommittedWorld): string {
  return `committed-world-v1:${JSON.stringify(stableValue({
    revision: world.revision,
    terrain: world.terrain,
    water: world.water,
    roads: world.roads,
    zones: world.zones,
    buildings: world.buildings,
    simulation: world.simulation,
    rci: world.rci,
    environments: {
      road: { terrainRevision: world.environments.road.terrainRevision, waterSourceTerrainRevision: world.environments.road.waterSourceTerrainRevision },
      zone: { terrainRevision: world.environments.zone.terrainRevision, waterSourceTerrainRevision: world.environments.zone.waterSourceTerrainRevision, roadRevision: world.environments.zone.roadRevision, occupancyRevision: world.environments.zone.occupancyRevision },
      building: { terrainRevision: world.environments.building.terrainRevision, waterSourceTerrainRevision: world.environments.building.waterSourceTerrainRevision, roadRevision: world.environments.building.roadRevision, zoneRevision: world.environments.building.zoneRevision },
    },
  }))}`;
}
EOF

python <<'PY'
from pathlib import Path
p = Path('apps/game/src/game-world-state.ts')
text = p.read_text()
if "import type { CommittedWorld }" not in text:
    text = "import type { CommittedWorld } from './application/committed-world.js';\n" + text
if 'export function gameWorldStateFromCommittedWorld' not in text:
    text += """

/** Compatibility projection while legacy runtime wiring migrates to CommittedWorldStore. */
export function gameWorldStateFromCommittedWorld(world: CommittedWorld): GameWorldState {
  return Object.freeze({ revision: world.revision, simulation: world.simulation, buildings: world.buildings, rci: world.rci });
}
"""
p.write_text(text)
p = Path('apps/game/src/game-world-state.test.ts')
text = p.read_text().replace("import { GameWorldStateStore } from './game-world-state.js';", "import { GameWorldStateStore, gameWorldStateFromCommittedWorld } from './game-world-state.js';")
if 'projects a committed world through the legacy compatibility shape' not in text:
    marker = "describe('GameWorldStateStore', () => {\n"
    test = """  it('projects a committed world through the legacy compatibility shape', () => {\n    const legacy = initialState();\n    const committed = { ...legacy, revision: 4 } as Parameters<typeof gameWorldStateFromCommittedWorld>[0];\n    expect(gameWorldStateFromCommittedWorld(committed)).toEqual({ revision: 4, simulation: legacy.simulation, buildings: legacy.buildings, rci: legacy.rci });\n  });\n\n"""
    text = text.replace(marker, marker + test, 1)
p.write_text(text)
p = Path('docs/systems/architecture-infrastructure/README.md')
text = p.read_text()
if '## Implementation Slice 2' not in text:
    text += """

## Implementation Slice 2

The complete committed-world application seam is available in `apps/game/src/application`. It composes Terrain, Water, Roads, Zones, Buildings, Simulation, RCI, and candidate-derived placement environments behind one application revision fence. Typed-array authority is copied on publication and read, environment provenance is validated before replacement, and content fingerprinting ignores adapter function identity. Legacy `GameWorldStateStore` remains the active compatibility path until the transaction/runtime migration in the next slice; PR 2 does not move Save, Undo, or gameplay mutation ownership.
"""
p.write_text(text)
PY

pnpm format
pnpm --filter @web-three-city/game test -- src/application/committed-world.test.ts src/game-world-state.test.ts src/world-save-v5.test.ts
pnpm --filter @web-three-city/game typecheck

git rm .github/workflows/architecture-pr2-author.yml tooling/architecture-pr2-author.sh
git add apps/game/src/application/committed-world.ts apps/game/src/application/committed-world-fingerprint.ts apps/game/src/application/committed-world.test.ts apps/game/src/game-world-state.ts apps/game/src/game-world-state.test.ts docs/systems/architecture-infrastructure/README.md
git commit -m 'refactor(game): define committed world application seam'
test -z "$(git status --porcelain=v1 --untracked-files=all)"
pnpm verify
git push origin HEAD:refactor/committed-world-application-seam-v0-1
