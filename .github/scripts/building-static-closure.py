from __future__ import annotations

import subprocess
from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one source fragment, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# Route the authoritative Building guard result through Zone preview/event state.
replace_once(
    "apps/game/src/game-input.ts",
    "import type { GameTerraformInvalidReason } from './terraform-occupancy-guard.js';\n",
    "import type { GameTerraformInvalidReason } from './terraform-occupancy-guard.js';\n"
    "import { createGuardedZonePresentation } from './zone-building-presentation.js';\n"
    "import type { GuardedZoneCandidate, GameZoneInvalidReason } from './zone-building-guard.js';\n",
)
replace_once(
    "apps/game/src/game-input.ts",
    """  readonly guardZonePlan?: (plan: ZoneMutationPlan) => {
    readonly previewPlan: ZoneMutationPlan;
    readonly valid: boolean;
    readonly invalidReason: import('./zone-building-guard.js').GameZoneInvalidReason | null;
  };
  readonly onZonePlan: (
    plan: ZoneMutationPlan,
    reason?: import('./zone-building-guard.js').GameZoneInvalidReason | null,
  ) => void;
""",
    """  readonly guardZonePlan?: (plan: ZoneMutationPlan) => GuardedZoneCandidate;
  readonly onZonePlan: (plan: ZoneMutationPlan, reason?: GameZoneInvalidReason | null) => void;
""",
)
replace_once(
    "apps/game/src/game-input.ts",
    """    onPreview(baseZones, plan): void {
      const candidate =
        plan === null
          ? null
          : (options.guardZonePlan?.(plan) ??
            Object.freeze({
              previewPlan: plan,
              valid: plan.valid,
              invalidReason: plan.invalidReason,
            }));
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
""",
    """    onPreview(baseZones, plan): void {
      const candidate =
        plan === null
          ? null
          : (options.guardZonePlan?.(plan) ??
            Object.freeze({
              corePlan: plan,
              previewPlan: plan,
              valid: plan.valid,
              invalidReason: plan.invalidReason,
              blockedBuildingCells: Object.freeze([]),
            }));
      routeZonePreview(options.zonePreview, baseZones, candidate?.previewPlan ?? null);
      const presentation = createGuardedZonePresentation(
        isZoneToolMode(mode) ? mode : null,
        candidate,
      );
      dispatchGameToolEvent(
        options.canvas,
        Object.freeze({ type: 'zone-state', ...presentation }),
      );
    },
""",
)
replace_once(
    "apps/game/src/game-input.ts",
    """            : (options.guardZonePlan?.(rawPlan) ?? {
                previewPlan: rawPlan,
                valid: rawPlan.valid,
                invalidReason: rawPlan.invalidReason,
              });
""",
    """            : (options.guardZonePlan?.(rawPlan) ??
              Object.freeze({
                corePlan: rawPlan,
                previewPlan: rawPlan,
                valid: rawPlan.valid,
                invalidReason: rawPlan.invalidReason,
                blockedBuildingCells: Object.freeze([]),
              }));
""",
)

replace_once(
    "apps/game/src/road-building-guard.ts",
    "  readonly blockedBuildingCells?: readonly CellCoord[];\n",
    "  readonly blockedBuildingCells: readonly CellCoord[];\n",
)

# Preserve the established interaction-evidence semantics and canonical scene root names.
replace_once(
    "apps/game/src/interaction-evidence.ts",
    """    get framingMarginRatio(): number {
      return CAMERA_DEFAULTS.framingMarginRatio;
    },
""",
    "    framingMarginRatio: CAMERA_DEFAULTS.framingMarginRatio,\n",
)
replace_once(
    "apps/game/src/interaction-evidence.ts",
    """    get terraform(): TerraformInteractionEvidence {
      return {
        ...source.getTerraformEvidence(),
""",
    """    get terraform(): TerraformInteractionEvidence {
      const state = source.getTerraformEvidence();
      return {
        ...state,
        previewValid: state.currentStampKind === 'no-change' ? false : state.previewValid,
        previewCellCount: Math.max(0, state.previewCellCount - state.supportCellCount),
""",
)
replace_once(
    "apps/game/src/interaction-evidence.ts",
    """        grid: countRoots(source.scene, 'terrain-grid-root'),
        selection: countRoots(source.scene, 'selected-cell-root'),
""",
    """        grid: countRoots(source.scene, 'terrain-grid-presentation-root'),
        selection: countRoots(source.scene, 'selected-cell-presentation-root'),
""",
)
replace_once(
    "apps/game/src/interaction-evidence.ts",
    """  Object.defineProperty(window, '__WEB_THREE_CITY_INTERACTION__', {
    configurable: true,
    enumerable: false,
    get: () => evidence,
  });
""",
    "  window.__WEB_THREE_CITY_INTERACTION__ = evidence;\n",
)

# Normalize and validate immutable definition-owned compatibility declarations.
replace_once(
    "packages/building-core/src/building-definitions.ts",
    """import type {
  BuildingDefinition,
""",
    """import { zoneDefinitionForId } from '@web-three-city/zone-core';
import type {
  BuildingDefinition,
""",
)
replace_once(
    "packages/building-core/src/building-definitions.ts",
    """function definition(value: BuildingDefinition): BuildingDefinition {
  if (
    !Number.isSafeInteger(value.footprintWidth) ||
    value.footprintWidth <= 0 ||
    !Number.isSafeInteger(value.footprintDepth) ||
    value.footprintDepth <= 0 ||
    value.allowedRotationQuarterTurns.length === 0 ||
    value.compatibleZoneDefinitionIds.length === 0 ||
    !Number.isFinite(value.prototypeHeight) ||
    value.prototypeHeight <= 0
  ) {
    throw new RangeError('building-definition:invalid');
  }
  return Object.freeze({
    ...value,
    allowedRotationQuarterTurns: Object.freeze([...value.allowedRotationQuarterTurns]),
    compatibleZoneDefinitionIds: Object.freeze([...value.compatibleZoneDefinitionIds]),
  });
}
""",
    """function definition(value: BuildingDefinition): BuildingDefinition {
  const rotations = [...value.allowedRotationQuarterTurns];
  const compatibleZoneDefinitionIds = [...value.compatibleZoneDefinitionIds];
  let referencesResolvable = true;
  try {
    for (const zoneDefinitionId of compatibleZoneDefinitionIds) {
      zoneDefinitionForId(zoneDefinitionId);
    }
  } catch {
    referencesResolvable = false;
  }
  if (
    !Number.isSafeInteger(value.footprintWidth) ||
    value.footprintWidth <= 0 ||
    !Number.isSafeInteger(value.footprintDepth) ||
    value.footprintDepth <= 0 ||
    !Number.isSafeInteger(value.selectionPriority) ||
    value.selectionPriority < 0 ||
    rotations.length === 0 ||
    new Set(rotations).size !== rotations.length ||
    rotations.some((rotation) => rotation < 0 || rotation > 3) ||
    compatibleZoneDefinitionIds.length === 0 ||
    new Set(compatibleZoneDefinitionIds).size !== compatibleZoneDefinitionIds.length ||
    compatibleZoneDefinitionIds.some((zoneDefinitionId) => zoneDefinitionId.length === 0) ||
    !referencesResolvable ||
    !Number.isFinite(value.prototypeHeight) ||
    value.prototypeHeight <= 0
  ) {
    throw new RangeError('building-definition:invalid');
  }
  return Object.freeze({
    ...value,
    allowedRotationQuarterTurns: Object.freeze(rotations.sort((first, second) => first - second)),
    compatibleZoneDefinitionIds: Object.freeze(
      compatibleZoneDefinitionIds.sort((first, second) => first.localeCompare(second)),
    ),
  });
}
""",
)

# Remove unsafe assertions from the authoritative mutation boundary.
replace_once(
    "packages/building-core/src/building-mutation.ts",
    "import { buildingDefinitions } from './building-definitions.js';\n",
    "import { buildingDefinitionForId, buildingDefinitions } from './building-definitions.js';\n",
)
replace_once(
    "packages/building-core/src/building-mutation.ts",
    """  const definition = buildingDefinitions().find(
    (candidate) => candidate.id === instance.buildingDefinitionId,
  );
  if (definition === undefined || !definition.compatibleZoneDefinitionIds.includes(originZone)) {
""",
    """  const definition = buildingDefinitionForId(instance.buildingDefinitionId);
  if (!definition.compatibleZoneDefinitionIds.includes(originZone)) {
""",
)
replace_once(
    "packages/building-core/src/building-mutation.ts",
    """  return (
    first.length === second.length &&
    first.every((instance, index) => sameInstance(instance, second[index]!))
  );
""",
    """  return (
    first.length === second.length &&
    first.every((instance, index) => {
      const candidate = second[index];
      return candidate !== undefined && sameInstance(instance, candidate);
    })
  );
""",
)
replace_once(
    "packages/building-core/src/building-mutation.ts",
    """    const verified =
      plan.operation === 'develop'
        ? planBuildingDevelopment(buildings, environment, config)
        : planBuildingBulldoze(buildings, plan.requestedCell!, environment, config);
""",
    """    let verified: BuildingMutationPlan;
    if (plan.operation === 'develop') {
      verified = planBuildingDevelopment(buildings, environment, config);
    } else {
      if (plan.requestedCell === null) {
        throw new BuildingContractError('building:invalid-proposed-state');
      }
      verified = planBuildingBulldoze(buildings, plan.requestedCell, environment, config);
    }
""",
)

replace_once(
    "packages/building-three/src/building-presentation.ts",
    """      const occupied = occupiedCellsForBuilding(instance);
      const elevation = Math.max(...occupied.map((cell) => this.#elevationAt(cell)));
""",
    """      const occupied = occupiedCellsForBuilding(instance);
      const firstOccupiedCell = occupied[0];
      if (firstOccupiedCell === undefined) {
        throw new Error('building-presentation:empty-footprint');
      }
      const elevation = occupied
        .slice(1)
        .reduce(
          (maximum, cell) => Math.max(maximum, this.#elevationAt(cell)),
          this.#elevationAt(firstOccupiedCell),
        );
""",
)

# Decoding remains a Result-returning, fail-closed boundary even if an accessor throws.
replace_once(
    "apps/game/src/world-save.ts",
    """  for (const instance of buildings.instances) {
    const definition = buildingDefinitionForId(instance.buildingDefinitionId);
    const cells = occupiedCellsForBuilding(instance);
    const firstCell = cells[0];
    const zoneId =
      firstCell === undefined ? null : buildingEnvironment.zoneDefinitionIdAt(firstCell);
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
""",
    """  try {
    for (const instance of buildings.instances) {
      const definition = buildingDefinitionForId(instance.buildingDefinitionId);
      const cells = occupiedCellsForBuilding(instance);
      const firstCell = cells[0];
      const zoneId =
        firstCell === undefined ? null : buildingEnvironment.zoneDefinitionIdAt(firstCell);
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
  } catch {
    return err({ code: 'world-save:invalid-building-placement' });
  }
""",
)

# Restore the ordinary test gate and remove every temporary authoring/diagnostic artifact.
master_ci = subprocess.check_output(
    ["git", "show", "origin/master:.github/workflows/ci.yml"], text=True
)
Path(".github/workflows/ci.yml").write_text(master_ci, encoding="utf-8")
for temporary in (
    ".github/workflows/building-static-diagnostics.yml",
    ".github/scripts/building-static-closure.py",
    ".building-authoring-trigger",
    ".authoring-output.txt",
    "sonar-findings.json",
):
    Path(temporary).unlink(missing_ok=True)
