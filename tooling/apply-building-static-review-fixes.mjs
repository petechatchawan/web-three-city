#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

async function replaceOnce(path, search, replacement) {
  const source = await readFile(path, 'utf8');
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`static-review:missing-pattern:${path}:${search.slice(0, 120)}`);
  await writeFile(path, source.slice(0, index) + replacement + source.slice(index + search.length), 'utf8');
}

// Game input owns widened Road/Zone guard reasons and forwards Building occupancy into Terraform.
await replaceOnce(
  'apps/game/src/game-input.ts',
  "import type { BuildingToolMode } from './game-tool-mode.js';\n",
  "import type { BuildingSnapshot } from '@web-three-city/building-core';\nimport type { BuildingToolMode } from './game-tool-mode.js';\n",
);
await replaceOnce(
  'apps/game/src/game-input.ts',
  "import type { GuardedRoadCandidate, GameRoadInvalidReason } from './road-zone-guard.js';\n",
  "import type { GuardedRoadBuildingCandidate, GameRoadBuildingInvalidReason } from './road-building-guard.js';\n",
);
await replaceOnce(
  'apps/game/src/game-input.ts',
  "  readonly getZoneEnvironment: () => ZonePlacementEnvironment;\n",
  "  readonly getZoneEnvironment: () => ZonePlacementEnvironment;\n  readonly getBuildingSnapshot?: () => BuildingSnapshot;\n",
);
await replaceOnce(
  'apps/game/src/game-input.ts',
  "  ) => GuardedRoadCandidate;\n",
  "  ) => GuardedRoadBuildingCandidate;\n",
);
await replaceOnce(
  'apps/game/src/game-input.ts',
  "  readonly onRoadPlan: (plan: RoadMutationPlan, reason?: GameRoadInvalidReason | null) => void;\n",
  "  readonly onRoadPlan: (plan: RoadMutationPlan, reason?: GameRoadBuildingInvalidReason | null) => void;\n",
);
await replaceOnce(
  'apps/game/src/game-input.ts',
  "    getZoneSnapshot: options.getZoneSnapshot,\n",
  "    getZoneSnapshot: options.getZoneSnapshot,\n    getBuildingSnapshot: options.getBuildingSnapshot,\n",
);
await replaceOnce(
  'apps/game/src/game-input.ts',
  "  const guardRoad = (plan: RoadMutationPlan, baseRoads: RoadSnapshot): GuardedRoadCandidate =>\n",
  "  const guardRoad = (plan: RoadMutationPlan, baseRoads: RoadSnapshot): GuardedRoadBuildingCandidate =>\n",
);
await replaceOnce(
  'apps/game/src/game-input.ts',
  "      blockedZoneCells: Object.freeze([]),\n    });\n",
  "      blockedZoneCells: Object.freeze([]),\n      blockedBuildingCells: Object.freeze([]),\n    });\n",
);
await replaceOnce(
  'apps/game/src/game-input.ts',
  `    onPreview(baseZones, plan): void {
      routeZonePreview(options.zonePreview, baseZones, plan);
      dispatchGameToolEvent(
        options.canvas,
        Object.freeze({
          type: 'zone-state',
          state: Object.freeze({
            mode: isZoneToolMode(mode) ? mode : null,
            strokeActive: plan !== null,
            previewValid: plan?.valid ?? null,
            previewInvalidReason: plan?.invalidReason ?? null,
            previewCellCount: plan?.requestedCells.length ?? 0,
          }),
          reason: plan?.invalidReason ?? null,
          effectiveCellCount: plan?.changedCells.length ?? 0,
          invalidCellCount: plan?.invalidCells.length ?? 0,
        }),
      );
    },
`,
  `    onPreview(baseZones, plan): void {
      const candidate =
        plan === null
          ? null
          : options.guardZonePlan?.(plan) ??
            Object.freeze({
              previewPlan: plan,
              valid: plan.valid,
              invalidReason: plan.invalidReason,
            });
      routeZonePreview(options.zonePreview, baseZones, candidate?.previewPlan ?? null);
      dispatchGameToolEvent(
        options.canvas,
        Object.freeze({
          type: 'zone-state',
          state: Object.freeze({
            mode: isZoneToolMode(mode) ? mode : null,
            strokeActive: candidate !== null,
            previewValid: candidate?.valid ?? null,
            previewInvalidReason: plan?.invalidReason ?? null,
            previewCellCount: plan?.requestedCells.length ?? 0,
          }),
          reason: candidate?.invalidReason ?? null,
          effectiveCellCount: candidate?.valid === true ? (plan?.changedCells.length ?? 0) : 0,
          invalidCellCount:
            candidate?.invalidReason === 'zone:building-occupied'
              ? 1
              : (plan?.invalidCells.length ?? 0),
        }),
      );
    },
`,
);

// Terraform stroke preview captures Building authority while preserving old callers through optional input.
await replaceOnce(
  'apps/game/src/terraform-stroke-session.ts',
  "import type { RoadSnapshot } from '@web-three-city/road-core';\n",
  "import type { BuildingSnapshot } from '@web-three-city/building-core';\nimport type { RoadSnapshot } from '@web-three-city/road-core';\n",
);
await replaceOnce(
  'apps/game/src/terraform-stroke-session.ts',
  "  readonly getZoneSnapshot?: () => ZoneSnapshot;\n",
  "  readonly getZoneSnapshot?: () => ZoneSnapshot;\n  readonly getBuildingSnapshot?: () => BuildingSnapshot;\n",
);
await replaceOnce(
  'apps/game/src/terraform-stroke-session.ts',
  "  let capturedZones: ZoneSnapshot | null = null;\n",
  "  let capturedZones: ZoneSnapshot | null = null;\n  let capturedBuildings: BuildingSnapshot | null = null;\n",
);
await replaceOnce(
  'apps/game/src/terraform-stroke-session.ts',
  "    capturedZones = null;\n",
  "    capturedZones = null;\n    capturedBuildings = null;\n",
);
await replaceOnce(
  'apps/game/src/terraform-stroke-session.ts',
  "    const guarded = guardTerraformPlanWithOccupancy(corePlan, capturedRoads, capturedZones);\n",
  "    const guarded = guardTerraformPlanWithOccupancy(\n      corePlan,\n      capturedRoads,\n      capturedZones,\n      capturedBuildings ?? undefined,\n    );\n",
);
await replaceOnce(
  'apps/game/src/terraform-stroke-session.ts',
  "      capturedZones = options.getZoneSnapshot?.() ?? createEmptyZoneSnapshot(options.config);\n",
  "      capturedZones = options.getZoneSnapshot?.() ?? createEmptyZoneSnapshot(options.config);\n      capturedBuildings = options.getBuildingSnapshot?.() ?? null;\n",
);
await replaceOnce(
  'apps/game/src/terraform-occupancy-guard.ts',
  "  buildings: BuildingSnapshot,\n): GuardedTerraformCandidate {\n",
  "  buildings?: BuildingSnapshot,\n): GuardedTerraformCandidate {\n",
);
await replaceOnce(
  'apps/game/src/terraform-occupancy-guard.ts',
  "  const blockedBuildingCells = blockedCellsFor(plan, zones.width, zones.height, (cell) => buildingOccupiedAt(buildings, cell));\n",
  "  const blockedBuildingCells =\n    buildings === undefined\n      ? EMPTY_CELLS\n      : blockedCellsFor(plan, zones.width, zones.height, (cell) =>\n          buildingOccupiedAt(buildings, cell),\n        );\n",
);

// Event and presentation contracts carry custom Building-aware guard reasons.
await replaceOnce(
  'apps/game/src/game-tool-events.ts',
  "import type { ZoneInvalidReason } from '@web-three-city/zone-core';\n",
  "import type { GameRoadBuildingInvalidReason } from './road-building-guard.js';\nimport type { GameZoneInvalidReason } from './zone-building-guard.js';\n",
);
await replaceOnce(
  'apps/game/src/game-tool-events.ts',
  "import type { GameRoadInvalidReason } from './road-zone-guard.js';\n",
  '',
);
await replaceOnce(
  'apps/game/src/game-tool-events.ts',
  "      readonly reason: GameRoadInvalidReason | null;\n",
  "      readonly reason: GameRoadBuildingInvalidReason | null;\n",
);
await replaceOnce(
  'apps/game/src/game-tool-events.ts',
  "      readonly reason: ZoneInvalidReason | null;\n",
  "      readonly reason: GameZoneInvalidReason | null;\n",
);
await replaceOnce(
  'apps/game/src/game-tool-presentation.ts',
  "import type { ZoneInvalidReason } from '@web-three-city/zone-core';\n",
  "import type { GameZoneInvalidReason } from './zone-building-guard.js';\n",
);
await replaceOnce(
  'apps/game/src/game-tool-presentation.ts',
  "      readonly reason: ZoneInvalidReason | null;\n",
  "      readonly reason: GameZoneInvalidReason | null;\n",
);
await replaceOnce(
  'apps/game/src/game-tool-presentation.ts',
  "      readonly reason: ZoneInvalidReason | null;\n",
  "      readonly reason: GameZoneInvalidReason | null;\n",
);
await replaceOnce(
  'apps/game/src/game-reason-catalog.ts',
  "import type { ZoneInvalidReason } from '@web-three-city/zone-core';\n",
  '',
);

// Runtime composition keeps all derived environments coherent after replacement and Undo.
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "import { createGameInput, type GameRenderViewport } from './game-input.js';\n",
  "import { createGameInput, type GameRenderViewport } from './game-input.js';\nimport { dispatchGameTransactionState } from './game-tool-events.js';\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  `import {
  createZonePlacementEnvironment,
  type ZoneWorldOccupancy,
} from './zone-placement-environment.js';
`,
  "import { createZonePlacementEnvironment } from './zone-placement-environment.js';\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "const EMPTY_WORLD_OCCUPANCY: ZoneWorldOccupancy = Object.freeze({ revision: 0, isBlocked: () => false });\n\n",
  '',
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "      ui.setZoneCounts(zoneCounts(zonesSnapshot));\n  ui.setBuildingCount(buildingCount(buildingsSnapshot));\n      ui.setBuildingCount(buildingCount(buildingsSnapshot));\n",
  "      ui.setZoneCounts(zoneCounts(zonesSnapshot));\n      ui.setBuildingCount(buildingCount(buildingsSnapshot));\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "    getZoneEnvironment: () => zoneEnvironment,\n",
  "    getZoneEnvironment: () => zoneEnvironment,\n    getBuildingSnapshot: () => buildingsSnapshot,\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "    const before = buildingsSnapshot;\n    try {\n",
  "    const before = buildingsSnapshot;\n    dispatchGameTransactionState(ui.canvas, 'committing', 'building');\n    try {\n",
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  `          zoneEnvironment = createZonePlacementEnvironment(
            snapshot,
            waterSnapshot,
            roadsSnapshot,
            EMPTY_WORLD_OCCUPANCY,
            WORLD_CONFIG,
          );
          roadUndoCount += 1;
`,
  `          zoneEnvironment = createZonePlacementEnvironment(
            snapshot,
            waterSnapshot,
            roadsSnapshot,
            createBuildingWorldOccupancy(buildingsSnapshot),
            WORLD_CONFIG,
          );
          buildingEnvironment = createBuildingDevelopmentEnvironment(
            snapshot,
            waterSnapshot,
            roadsSnapshot,
            zonesSnapshot,
            WORLD_CONFIG,
          );
          roadUndoCount += 1;
`,
);
await replaceOnce(
  'apps/game/src/game-bootstrap.ts',
  "  ui.setZoneCounts(zoneCounts(zonesSnapshot));\n  ui.setStatus('Ready');\n",
  "  ui.setZoneCounts(zoneCounts(zonesSnapshot));\n  ui.setBuildingCount(buildingCount(buildingsSnapshot));\n  ui.setStatus('Ready');\n",
);

// WorldSaveV3 narrows homogeneous Zone identity before compatibility checks.
await replaceOnce(
  'apps/game/src/world-save.ts',
  `  for (const instance of buildings.instances) {
    const definition = buildingDefinitionForId(instance.buildingDefinitionId); const cells = occupiedCellsForBuilding(instance); const zoneIds = new Set(cells.map((cell) => buildingEnvironment.zoneDefinitionIdAt(cell)));
    const invalid = zoneIds.size !== 1 || zoneIds.has(null) || !definition.compatibleZoneDefinitionIds.includes([...zoneIds][0]!) || cells.some((cell) => !buildingEnvironment.isDry(cell) || buildingEnvironment.surfaceAt(cell).shape !== 'flat' || buildingEnvironment.isRoadOccupied(cell)) || resolveBuildingFrontage(instance, buildingEnvironment) === null;
    if (invalid) return err({ code: 'world-save:invalid-building-placement', details: Object.freeze({ instanceId: instance.instanceId }) });
  }
`,
  `  for (const instance of buildings.instances) {
    const definition = buildingDefinitionForId(instance.buildingDefinitionId);
    const cells = occupiedCellsForBuilding(instance);
    const firstCell = cells[0];
    const zoneId = firstCell === undefined ? null : buildingEnvironment.zoneDefinitionIdAt(firstCell);
    const invalid =
      zoneId === null ||
      !definition.compatibleZoneDefinitionIds.includes(zoneId) ||
      cells.some(
        (cell) =>
          buildingEnvironment.zoneDefinitionIdAt(cell) !== zoneId ||
          !buildingEnvironment.isDry(cell) ||
          buildingEnvironment.surfaceAt(cell).shape !== 'flat' ||
          buildingEnvironment.isRoadOccupied(cell),
      ) ||
      resolveBuildingFrontage(instance, buildingEnvironment) === null;
    if (invalid) {
      return err({
        code: 'world-save:invalid-building-placement',
        details: Object.freeze({ instanceId: instance.instanceId }),
      });
    }
  }
`,
);

// HUD and evidence label Building transactions and widened Zone reasons correctly.
await replaceOnce(
  'apps/game/src/game-ui.ts',
  `      const domain =
        state.interaction.domain === 'terraform'
          ? 'Terrain'
          : state.interaction.domain === 'road'
            ? 'Road'
            : 'Zone';
`,
  `      const domain =
        state.interaction.domain === 'terraform'
          ? 'Terrain'
          : state.interaction.domain === 'road'
            ? 'Road'
            : state.interaction.domain === 'zone'
              ? 'Zone'
              : 'Building';
`,
);
await replaceOnce(
  'apps/game/src/interaction-evidence.ts',
  "import type { GameTerraformInvalidReason } from './terraform-occupancy-guard.js';\n",
  "import type { GameTerraformInvalidReason } from './terraform-occupancy-guard.js';\nimport type { GameZoneInvalidReason } from './zone-building-guard.js';\n",
);
await replaceOnce(
  'apps/game/src/interaction-evidence.ts',
  "  readonly invalidReason: ZoneInvalidReason | null;\n  readonly committedRootCount: number;\n",
  "  readonly invalidReason: GameZoneInvalidReason | null;\n  readonly committedRootCount: number;\n",
);

// Undo presentation includes Building ownership.
await replaceOnce(
  'apps/game/src/game-transaction-presentation.ts',
  `const ZONE_UNDO = Object.freeze({
  state: 'undoing',
  domain: 'zone',
}) satisfies GameTransactionAnnouncement;
`,
  `const ZONE_UNDO = Object.freeze({
  state: 'undoing',
  domain: 'zone',
}) satisfies GameTransactionAnnouncement;
const BUILDING_UNDO = Object.freeze({
  state: 'undoing',
  domain: 'building',
}) satisfies GameTransactionAnnouncement;
`,
);
await replaceOnce(
  'apps/game/src/game-transaction-presentation.ts',
  "  if (domain === 'zone') return ZONE_UNDO;\n",
  "  if (domain === 'zone') return ZONE_UNDO;\n  if (domain === 'building') return BUILDING_UNDO;\n",
);

// Existing fixtures and tests adopt the expanded contracts; no test command is executed here.
await replaceOnce(
  'apps/game/src/game-ui.test.ts',
  "            blockedZoneCells: Object.freeze([]),\n",
  "            blockedZoneCells: Object.freeze([]),\n            blockedBuildingCells: Object.freeze([]),\n",
);
await replaceOnce(
  'apps/game/src/game-ui.test.ts',
  "    expect(root.querySelector('[data-testid=\"tool-close\"]')).toBe(ui.closeToolButton);\n",
  "    expect(root.querySelector('[data-testid=\"tool-close\"]')).toBe(ui.closeToolButton);\n    expect(root.querySelector('[data-action=\"tool-building-develop\"]')).toBe(ui.buildingDevelopButton);\n    expect(root.querySelector('[data-action=\"tool-building-bulldoze\"]')).toBe(ui.buildingBulldozeButton);\n    ui.setBuildingCount(3);\n    expect(root.querySelector('[data-testid=\"building-count\"]')?.textContent).toBe('3');\n",
);
await replaceOnce(
  'apps/game/src/game-transaction-presentation.test.ts',
  "function evidence(undoKind: 'terraform' | 'road' | 'zone' | null): InteractionEvidence {\n",
  "function evidence(undoKind: 'terraform' | 'road' | 'zone' | 'building' | null): InteractionEvidence {\n",
);
await replaceOnce(
  'apps/game/src/game-transaction-presentation.test.ts',
  "    expect(undoTransaction(evidence('zone'))).toEqual({\n      state: 'undoing',\n      domain: 'zone',\n    });\n",
  "    expect(undoTransaction(evidence('zone'))).toEqual({\n      state: 'undoing',\n      domain: 'zone',\n    });\n    expect(undoTransaction(evidence('building'))).toEqual({\n      state: 'undoing',\n      domain: 'building',\n    });\n",
);

console.log('Applied Building Foundation static-review fixes without running verification');
