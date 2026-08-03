from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    if old not in source:
        raise RuntimeError(f'atomicity:missing-pattern:{path}:{old[:120]}')
    target.write_text(source.replace(old, new, 1), encoding='utf-8')


replace_once(
    'packages/building-core/src/building-mutation.ts',
    "  let zonedCellCount = 0;\n  let sequence = 0;\n",
    "  let zonedCellCount = 0;\n  let environmentFailed = false;\n  let sequence = 0;\n",
)
replace_once(
    'packages/building-core/src/building-mutation.ts',
    "  } catch {\n    reasons.add('building:invalid-environment');\n  }\n\n  const invalidReason: BuildingInvalidReason | null =\n    added.length > 0\n      ? null\n      : zonedCellCount === 0\n        ? 'building:no-zoned-lot'\n        : primaryReason(reasons);\n",
    "  } catch {\n    environmentFailed = true;\n    reasons.add('building:invalid-environment');\n  }\n\n  const invalidReason: BuildingInvalidReason | null = environmentFailed\n    ? 'building:invalid-environment'\n    : added.length > 0\n      ? null\n      : zonedCellCount === 0\n        ? 'building:no-zoned-lot'\n        : primaryReason(reasons);\n",
)
replace_once(
    'packages/building-core/src/building-mutation.ts',
    "    proposedInstances: [...validated.instances, ...added],\n    addedInstances: added,\n    removedInstances: Object.freeze([]),\n    dirtyChunks: dirty,\n",
    "    proposedInstances: environmentFailed\n      ? validated.instances\n      : [...validated.instances, ...added],\n    addedInstances: environmentFailed ? Object.freeze([]) : added,\n    removedInstances: Object.freeze([]),\n    dirtyChunks: environmentFailed ? Object.freeze([]) : dirty,\n",
)

replace_once(
    'packages/building-core/test/building-mutation.test.ts',
    "  it('fails closed for mixed Zones and stale source revisions', () => {\n",
    "  it('discards every accepted lot when an environment accessor fails mid-scan', () => {\n    const before = createEmptyBuildingSnapshot(CONFIG);\n    const unstable = environment({\n      zoneDefinitionIdAt(cell) {\n        if (cell.z === 1 && cell.x === 3) throw new Error('environment unavailable');\n        return cell.x >= 1 && cell.x <= 2 && cell.z >= 1 && cell.z <= 2\n          ? 'commercial'\n          : null;\n      },\n    });\n\n    const plan = planBuildingDevelopment(before, unstable, CONFIG);\n\n    expect(plan).toMatchObject({\n      valid: false,\n      invalidReason: 'building:invalid-environment',\n      proposedInstances: [],\n      addedInstances: [],\n      dirtyChunks: [],\n    });\n  });\n\n  it('fails closed for mixed Zones and stale source revisions', () => {\n",
)

replace_once(
    'apps/game/src/road-building-guard.ts',
    "  readonly blockedBuildingCells: readonly CellCoord[];\n",
    "  readonly blockedBuildingCells?: readonly CellCoord[];\n",
)

print('Finalized Building atomicity corrections without running verification')
