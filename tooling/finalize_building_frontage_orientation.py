from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    if old not in source:
        raise RuntimeError(f'frontage:missing-pattern:{path}:{old[:140]}')
    target.write_text(source.replace(old, new, 1), encoding='utf-8')


replace_once(
    'packages/building-core/src/building-mutation.ts',
    "import { occupiedCellsForBuilding } from './building-footprint.js';\n",
    "import { buildingEntranceDirection, occupiedCellsForBuilding } from './building-footprint.js';\n",
)
replace_once(
    'packages/building-core/src/building-mutation.ts',
    "  type BuildingInstance,\n",
    "  type BuildingFrontage,\n  type BuildingInstance,\n",
)
replace_once(
    'packages/building-core/src/building-mutation.ts',
    "  if (resolveBuildingFrontage(instance, environment) === null) {\n    return 'building:road-access-required';\n  }\n  return null;\n}\n",
    "  return null;\n}\n\nfunction frontageDirectionOrder(direction: BuildingFrontage['direction']): number {\n  switch (direction) {\n    case 'north':\n      return 0;\n    case 'east':\n      return 1;\n    case 'south':\n      return 2;\n    case 'west':\n      return 3;\n  }\n}\n",
)
old_loop = """        let accepted: BuildingInstance | null = null;
        for (const definition of definitions) {
          for (const rotation of [...definition.allowedRotationQuarterTurns].sort()) {
            const instance: BuildingInstance = Object.freeze({
              instanceId: `building:${targetRevision}:${sequence + 1}`,
              buildingDefinitionId: definition.id,
              buildingDefinitionVersion: definition.version,
              originCell,
              rotationQuarterTurns: rotation,
            });
            const reason = candidateReason(instance, occupied, environment, config);
            if (reason === null) {
              accepted = instance;
              break;
            }
            reasons.add(reason);
          }
          if (accepted !== null) break;
        }
"""
new_loop = """        let accepted: BuildingInstance | null = null;
        for (const definition of definitions) {
          const placements: Array<{
            readonly instance: BuildingInstance;
            readonly frontage: BuildingFrontage;
          }> = [];
          for (const rotation of [...definition.allowedRotationQuarterTurns].sort()) {
            const instance: BuildingInstance = Object.freeze({
              instanceId: `building:${targetRevision}:${sequence + 1}`,
              buildingDefinitionId: definition.id,
              buildingDefinitionVersion: definition.version,
              originCell,
              rotationQuarterTurns: rotation,
            });
            const reason = candidateReason(instance, occupied, environment, config);
            if (reason !== null) {
              reasons.add(reason);
              continue;
            }
            const frontage = resolveBuildingFrontage(instance, environment);
            if (frontage === null) {
              reasons.add('building:road-access-required');
              continue;
            }
            placements.push(Object.freeze({ instance, frontage }));
          }
          placements.sort((first, second) => {
            const firstMisaligned =
              buildingEntranceDirection(first.instance.rotationQuarterTurns) ===
              first.frontage.direction
                ? 0
                : 1;
            const secondMisaligned =
              buildingEntranceDirection(second.instance.rotationQuarterTurns) ===
              second.frontage.direction
                ? 0
                : 1;
            return (
              firstMisaligned - secondMisaligned ||
              first.frontage.distance - second.frontage.distance ||
              frontageDirectionOrder(first.frontage.direction) -
                frontageDirectionOrder(second.frontage.direction) ||
              first.frontage.frontageCell.z - second.frontage.frontageCell.z ||
              first.frontage.frontageCell.x - second.frontage.frontageCell.x ||
              first.instance.rotationQuarterTurns - second.instance.rotationQuarterTurns
            );
          });
          accepted = placements[0]?.instance ?? null;
          if (accepted !== null) break;
        }
"""
replace_once('packages/building-core/src/building-mutation.ts', old_loop, new_loop)

replace_once(
    'packages/building-core/test/building-footprint.test.ts',
    "  buildingDefinitionForId,\n",
    "  buildingDefinitionForId,\n  buildingEntranceDirection,\n",
)
replace_once(
    'packages/building-core/test/building-footprint.test.ts',
    "  it('swaps canonical dimensions on odd quarter turns', () => {\n",
    "  it('maps the canonical south entrance edge through quarter turns', () => {\n    expect([0, 1, 2, 3].map((rotation) => buildingEntranceDirection(rotation as 0 | 1 | 2 | 3))).toEqual([\n      'south',\n      'west',\n      'north',\n      'east',\n    ]);\n  });\n\n  it('swaps canonical dimensions on odd quarter turns', () => {\n",
)
replace_once(
    'packages/building-core/test/building-mutation.test.ts',
    "      rotationQuarterTurns: 0,\n",
    "      rotationQuarterTurns: 2,\n",
)
replace_once(
    'packages/building-core/test/building-mutation.test.ts',
    "  it('bulldozes the whole instance selected by any occupied cell', () => {\n",
    "  it('persists the rotation whose canonical entrance faces deterministic frontage', () => {\n    const before = createEmptyBuildingSnapshot(CONFIG);\n    const plan = planBuildingDevelopment(before, environment(), CONFIG);\n\n    expect(plan.addedInstances[0]?.rotationQuarterTurns).toBe(2);\n  });\n\n  it('bulldozes the whole instance selected by any occupied cell', () => {\n",
)

replace_once(
    'docs/superpowers/specs/2026-08-03-building-content-occupancy-foundation-v0-1-design.md',
    "3. Select allowed rotations in numeric order.\n4. Resolve frontage by shortest road-access distance, then direction order `north`, `east`, `south`, `west`, then frontage-cell `z`, then `x`.\n",
    "3. Evaluate allowed rotations in numeric order, then prefer the valid rotation whose canonical south entrance edge faces the resolved Road frontage.\n4. Break remaining rotation ties by shortest road-access distance, direction order `north`, `east`, `south`, `west`, frontage-cell `z`, frontage-cell `x`, then numeric rotation.\n",
)
replace_once(
    'docs/superpowers/specs/2026-08-03-building-content-occupancy-foundation-v0-1-design.md',
    "- road-facing edge\n- frontage cell\n",
    "- road-facing edge\n- entrance direction derived from rotation\n- frontage cell\n",
)

print('Finalized Building frontage orientation without running verification')
