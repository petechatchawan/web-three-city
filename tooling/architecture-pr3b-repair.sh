#!/usr/bin/env bash
set -euo pipefail

python <<'PY'
from pathlib import Path
p = Path('tooling/architecture-pr3b-author.sh')
text = p.read_text()

# Keep diagnostics precise and compare committed content, not adapter function identity.
text = text.replace(
    "    expect(loaded.status).toBe('committed');\n    if (loaded.status === 'committed') {",
    "    if (loaded.status === 'rejected') throw new Error(`load-rejected:${loaded.reason}`);\n    expect(loaded.status).toBe('committed');\n    if (loaded.status === 'committed') {",
    1,
)
text = text.replace(
    "    expect(store.snapshot()).toEqual(initial);",
    "    expect(fingerprintCommittedWorld(store.snapshot())).toBe(\n      fingerprintCommittedWorld(initial),\n    );",
    1,
)

# Make the application fixture a valid world: commercial zone with north road frontage.
text = text.replace(
    "import { createEmptyRoadSnapshot, type RoadSnapshot } from '@web-three-city/road-core';",
    "import { BASIC_ROAD_CODE, createEmptyRoadSnapshot, type RoadSnapshot } from '@web-three-city/road-core';",
    1,
)
text = text.replace(
    "import { createEmptyZoneSnapshot, type ZoneSnapshot } from '@web-three-city/zone-core';",
    "import { COMMERCIAL_ZONE_CODE, createEmptyZoneSnapshot, type ZoneSnapshot } from '@web-three-city/zone-core';",
    1,
)
text = text.replace(
    "  buildingRevision?: number;\n} = {}): CommittedWorld {\n  const applicationRevision = input.applicationRevision ?? 0;",
    "  buildingRevision?: number;\n  withCommercialInfrastructure?: boolean;\n} = {}): CommittedWorld {\n  const applicationRevision = input.applicationRevision ?? 0;\n  const withCommercialInfrastructure = input.withCommercialInfrastructure ?? true;",
    1,
)
old_roads = """  const roadsBase = createEmptyRoadSnapshot(WORLD_CONFIG);
  const roads: RoadSnapshot = Object.freeze({
    width: roadsBase.width,
    height: roadsBase.height,
    revision: roadsBase.revision,
    definitionCodes: roadsBase.definitionCodes,
  });
  const zonesBase = createEmptyZoneSnapshot(WORLD_CONFIG);
  const zones: ZoneSnapshot = Object.freeze({
    width: zonesBase.width,
    height: zonesBase.height,
    revision: zonesBase.revision,
    definitionCodes: zonesBase.definitionCodes,
  });
"""
new_roads = """  const roadsBase = createEmptyRoadSnapshot(WORLD_CONFIG);
  const roadCodes = roadsBase.definitionCodes.slice();
  if (withCommercialInfrastructure) {
    roadCodes[3 * WORLD_CONFIG.mapWidth + 4] = BASIC_ROAD_CODE;
  }
  const roads: RoadSnapshot = Object.freeze({
    width: roadsBase.width,
    height: roadsBase.height,
    revision: withCommercialInfrastructure ? 1 : roadsBase.revision,
    definitionCodes: roadCodes,
  });
  const zonesBase = createEmptyZoneSnapshot(WORLD_CONFIG);
  const zoneCodes = zonesBase.definitionCodes.slice();
  if (withCommercialInfrastructure) {
    zoneCodes[4 * WORLD_CONFIG.mapWidth + 4] = COMMERCIAL_ZONE_CODE;
  }
  const zones: ZoneSnapshot = Object.freeze({
    width: zonesBase.width,
    height: zonesBase.height,
    revision: withCommercialInfrastructure ? 1 : zonesBase.revision,
    definitionCodes: zoneCodes,
  });
"""
if old_roads not in text:
    raise SystemExit('fixture road/zone block changed unexpectedly')
text = text.replace(old_roads, new_roads, 1)

# Add a candidate-invalidity contract: invalid Building placement must never publish.
marker = "  it('commits once before presentation and never rolls domain authority back on adapter failure', () => {\n"
invalid_test = """  it('rejects invalid Building placement before changing authority', () => {
    const initial = createApplicationFixture();
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(initial),
    });
    const invalid = createApplicationFixture({
      applicationRevision: 1,
      withCommercialBuilding: true,
      withCommercialInfrastructure: false,
    });

    const result = coordinator.publish({
      baseRevision: initial.revision,
      baseFingerprint: fingerprintCommittedWorld(initial),
      nextWorld: invalid,
      nextFingerprint: fingerprintCommittedWorld(invalid),
    });

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.reason).toBe('world:invalid-candidate');
    expect(fingerprintCommittedWorld(coordinator.snapshot())).toBe(
      fingerprintCommittedWorld(initial),
    );
  });

"""
if invalid_test not in text:
    if marker not in text:
        raise SystemExit('transaction test marker changed unexpectedly')
    text = text.replace(marker, invalid_test + marker, 1)

# Validate complete candidates using existing domain policies without Save encode/decode overhead.
text = text.replace(
    "import { createFoundationRciRegistries, validateRciSnapshot } from '@web-three-city/rci-core';",
    "import {\n  buildingDefinitionForId,\n  occupiedCellsForBuilding,\n  resolveBuildingFrontage,\n} from '@web-three-city/building-core';\nimport { roadCellPolicyInvalidReason, roadOccupiedAt } from '@web-three-city/road-core';\nimport { createFoundationRciRegistries, validateRciSnapshot } from '@web-three-city/rci-core';\nimport { WORLD_CONFIG } from '@web-three-city/world-core';\nimport { zoneCellPolicyInvalidReason, zoneOccupiedAt } from '@web-three-city/zone-core';\nimport { createZonePlacementEnvironment } from '../zone-placement-environment.js';",
    1,
)
rejected_marker = "function rejected(world: CommittedWorld, reason: WorldPublicationRejection): WorldPublicationResult {\n"
validator = """function validCandidate(world: CommittedWorld): boolean {
  for (let z = 0; z < WORLD_CONFIG.mapHeight; z += 1) {
    for (let x = 0; x < WORLD_CONFIG.mapWidth; x += 1) {
      const cell = { x, z };
      if (
        roadOccupiedAt(world.roads, cell) &&
        roadCellPolicyInvalidReason(world.roads, cell, world.environments.road, WORLD_CONFIG) !== null
      ) {
        return false;
      }
    }
  }

  const emptyOccupancy = Object.freeze({ revision: 0, isBlocked: () => false });
  const zoneEnvironment = createZonePlacementEnvironment(
    world.terrain,
    world.water,
    world.roads,
    emptyOccupancy,
    WORLD_CONFIG,
  );
  for (let z = 0; z < WORLD_CONFIG.mapHeight; z += 1) {
    for (let x = 0; x < WORLD_CONFIG.mapWidth; x += 1) {
      const cell = { x, z };
      if (
        zoneOccupiedAt(world.zones, cell) &&
        zoneCellPolicyInvalidReason(world.zones, cell, zoneEnvironment, WORLD_CONFIG) !== null
      ) {
        return false;
      }
    }
  }

  for (const instance of world.buildings.instances) {
    if (
      instance.lifecycle === 'construction' &&
      instance.constructionCompletesAtTick <= world.simulation.absoluteTick
    ) {
      return false;
    }
    const definition = buildingDefinitionForId(instance.buildingDefinitionId);
    const cells = occupiedCellsForBuilding(instance);
    const firstCell = cells[0];
    const zoneId =
      firstCell === undefined ? null : world.environments.building.zoneDefinitionIdAt(firstCell);
    if (
      zoneId === null ||
      !definition.compatibleZoneDefinitionIds.includes(zoneId) ||
      cells.some(
        (cell) =>
          world.environments.building.zoneDefinitionIdAt(cell) !== zoneId ||
          !world.environments.building.isDry(cell) ||
          world.environments.building.surfaceAt(cell).shape !== 'flat' ||
          world.environments.building.isRoadOccupied(cell),
      ) ||
      resolveBuildingFrontage(instance, world.environments.building) === null
    ) {
      return false;
    }
  }

  return validateRciSnapshot(
    world.rci,
    world.buildings,
    world.simulation,
    createFoundationRciRegistries(),
  ).valid;
}

"""
if validator not in text:
    if rejected_marker not in text:
        raise SystemExit('coordinator rejection marker changed unexpectedly')
    text = text.replace(rejected_marker, validator + rejected_marker, 1)
old_validation = """      const rciValidation = validateRciSnapshot(
        candidate.rci,
        candidate.buildings,
        candidate.simulation,
        createFoundationRciRegistries(),
      );
      if (!rciValidation.valid) return rejected(current, 'world:invalid-candidate');
      candidate = this.#worldStore.replace(current.revision, candidate);
"""
new_validation = """      if (!validCandidate(candidate)) return rejected(current, 'world:invalid-candidate');
      candidate = this.#worldStore.replace(current.revision, candidate);
"""
if old_validation not in text:
    raise SystemExit('coordinator validation block changed unexpectedly')
text = text.replace(old_validation, new_validation, 1)

text = text.replace(
    "git rm .github/workflows/architecture-pr3b-author.yml tooling/architecture-pr3b-author.sh",
    "git rm .github/workflows/architecture-pr3b-author.yml tooling/architecture-pr3b-author.sh tooling/architecture-pr3b-repair.sh",
    1,
)
p.write_text(text)
PY

bash tooling/architecture-pr3b-author.sh
