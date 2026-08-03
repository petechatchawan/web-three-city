from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    if old not in source:
        raise RuntimeError(f'orientation:missing-pattern:{path}:{old[:140]}')
    target.write_text(source.replace(old, new, 1), encoding='utf-8')


replace_once(
    'apps/game/src/world-save.ts',
    "  buildingDefinitionForId,\n",
    "  buildingDefinitionForId,\n  buildingEntranceDirection,\n",
)
replace_once(
    'apps/game/src/world-save.ts',
    "    const invalid =\n      zoneId === null ||\n",
    "    const frontage = resolveBuildingFrontage(instance, buildingEnvironment);\n    const invalid =\n      zoneId === null ||\n",
)
replace_once(
    'apps/game/src/world-save.ts',
    "      ) ||\n      resolveBuildingFrontage(instance, buildingEnvironment) === null;\n",
    "      ) ||\n      frontage === null ||\n      buildingEntranceDirection(instance.rotationQuarterTurns) !== frontage.direction;\n",
)

replace_once(
    'apps/game/src/world-save-building.test.ts',
    "    rotationQuarterTurns: 0,\n",
    "    rotationQuarterTurns: 2,\n",
)
replace_once(
    'apps/game/src/world-save-building.test.ts',
    "        rotationQuarterTurns: 0,\n",
    "        rotationQuarterTurns: 2,\n",
)
replace_once(
    'apps/game/src/world-save-building.test.ts',
    "  it('rejects homogeneous incompatible and mixed-Zone Building footprints', () => {\n",
    "  it('rejects a saved rotation whose canonical entrance does not face deterministic frontage', () => {\n    const misaligned = decodeWorldSave(\n      encodeWorldSaveV3(terrain(), roads(), zones(), buildings([office({ rotationQuarterTurns: 0 })])),\n      WORLD_CONFIG,\n    );\n\n    expect(misaligned).toEqual({\n      ok: false,\n      error: {\n        code: 'world-save:invalid-building-placement',\n        details: { instanceId: 'building:6:1' },\n      },\n    });\n  });\n\n  it('rejects homogeneous incompatible and mixed-Zone Building footprints', () => {\n",
)

replace_once(
    'packages/building-three/src/prototype-factory.ts',
    "      addBox(\n        group,\n        [0.84, h * 0.12, 1.78],\n        [0, h * 0.88, 0],\n        materials.roof,\n        'building-roof',\n      );\n      break;\n",
    "      addBox(\n        group,\n        [0.84, h * 0.12, 1.78],\n        [0, h * 0.88, 0],\n        materials.roof,\n        'building-roof',\n      );\n      addBox(\n        group,\n        [0.18, 0.34, 0.05],\n        [0, 0.22, 0.875],\n        materials.accent,\n        'building-door',\n      );\n      break;\n",
)
replace_once(
    'packages/building-three/src/prototype-factory.ts',
    "      for (const y of [0.45, 0.95, 1.45])\n        addBox(\n          group,\n          [1.72, 0.06, 1.72],\n          [0, y, 0],\n          materials.accent,\n          'building-floor-band',\n        );\n      break;\n",
    "      for (const y of [0.45, 0.95, 1.45])\n        addBox(\n          group,\n          [1.72, 0.06, 1.72],\n          [0, y, 0],\n          materials.accent,\n          'building-floor-band',\n        );\n      addBox(\n        group,\n        [0.36, 0.46, 0.05],\n        [0, 0.28, 0.85],\n        materials.accent,\n        'building-entrance',\n      );\n      break;\n",
)

replace_once(
    'packages/building-three/test/building-presentation.test.ts',
    "    expect(presentation.root.children[1]?.rotation.y).toBeCloseTo(-Math.PI / 2);\n",
    "    expect(presentation.root.children[1]?.rotation.y).toBeCloseTo(-Math.PI / 2);\n    expect(\n      presentation.root.children.every((child) =>\n        child.children.some((part) =>\n          ['building-door', 'building-storefront', 'building-entrance', 'building-bay-door'].includes(\n            part.name,\n          ),\n        ),\n      ),\n    ).toBe(true);\n",
)

replace_once(
    'docs/superpowers/specs/2026-08-03-building-content-occupancy-foundation-v0-1-design.md',
    "- missing Road frontage\n- incoherent World revisions\n",
    "- missing Road frontage\n- a persisted rotation whose canonical entrance does not face deterministic frontage\n- incoherent World revisions\n",
)

print('Finalized Building orientation invariant without running verification')
