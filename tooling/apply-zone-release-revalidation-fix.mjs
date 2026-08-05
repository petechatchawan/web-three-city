import { readFile, writeFile } from 'node:fs/promises';

const path = 'apps/game/src/game-bootstrap.ts';
let source = await readFile(path, 'utf8');

const importBefore = `  commitZoneMutation,\n  createEmptyZoneSnapshot,\n  zoneCounts,`;
const importAfter = `  commitZoneMutation,\n  createEmptyZoneSnapshot,\n  planZoneMutation,\n  zoneCounts,`;
if (!source.includes(importBefore)) {
  throw new Error('zone-release-revalidation:missing-import-pattern');
}
source = source.replace(importBefore, importAfter);

const applyBefore = `  const applyZonePlan = (\n    plan: ZoneMutationPlan,\n    routedReason: GameZoneInvalidReason | null = plan.invalidReason,\n  ): void => {\n    zoneInvalidReason = routedReason;\n    const candidate = guardZonePlanWithBuildings(plan, buildingsSnapshot);\n    const reason = routedReason ?? candidate.invalidReason;`;
const applyAfter = `  const applyZonePlan = (plan: ZoneMutationPlan): void => {\n    const revalidatedPlan = planZoneMutation(\n      zonesSnapshot,\n      {\n        operation: plan.operation,\n        definitionId: plan.definitionId,\n        cells: plan.requestedCells,\n      },\n      zoneEnvironment,\n      WORLD_CONFIG,\n    );\n    const candidate = guardZonePlanWithBuildings(revalidatedPlan, buildingsSnapshot);\n    const reason = candidate.invalidReason;\n    zoneInvalidReason = reason;`;
if (!source.includes(applyBefore)) {
  throw new Error('zone-release-revalidation:missing-apply-pattern');
}
source = source.replace(applyBefore, applyAfter);

await writeFile(path, source);
