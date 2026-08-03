from pathlib import Path

path = Path('tooling/apply-building-static-review-fixes.mjs')
source = path.read_text(encoding='utf-8')
old = '"  buildings: BuildingSnapshot,\\n): GuardedTerraformCandidate {\\n",'
new = '"export function guardTerraformPlanWithOccupancy(plan: TerraformPlan, roads: RoadSnapshot, zones: ZoneSnapshot, buildings: BuildingSnapshot): GuardedTerraformCandidate {\\n",'
if old not in source:
    raise RuntimeError('repair:missing-terraform-signature-pattern')
source = source.replace(old, new, 1)
path.write_text(source, encoding='utf-8')
print('Repaired Building static-review script matching')
