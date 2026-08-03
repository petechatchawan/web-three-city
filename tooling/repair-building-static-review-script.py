from pathlib import Path

path = Path('tooling/apply-building-static-review-fixes.mjs')
source = path.read_text(encoding='utf-8')
search_old = '"  buildings: BuildingSnapshot,\\n): GuardedTerraformCandidate {\\n",'
search_new = '"export function guardTerraformPlanWithOccupancy(plan: TerraformPlan, roads: RoadSnapshot, zones: ZoneSnapshot, buildings: BuildingSnapshot): GuardedTerraformCandidate {\\n",'
replacement_old = '"  buildings?: BuildingSnapshot,\\n): GuardedTerraformCandidate {\\n",'
replacement_new = '"export function guardTerraformPlanWithOccupancy(\\n  plan: TerraformPlan,\\n  roads: RoadSnapshot,\\n  zones: ZoneSnapshot,\\n  buildings?: BuildingSnapshot,\\n): GuardedTerraformCandidate {\\n",'
for old, new, label in [
    (search_old, search_new, 'search'),
    (replacement_old, replacement_new, 'replacement'),
]:
    if old not in source:
        raise RuntimeError(f'repair:missing-terraform-signature-{label}')
    source = source.replace(old, new, 1)
path.write_text(source, encoding='utf-8')
print('Repaired full Terraform guard signature patch')
