from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    if old not in source:
        raise RuntimeError(f'compatibility:missing-pattern:{path}:{old[:120]}')
    target.write_text(source.replace(old, new, 1), encoding='utf-8')


replace_once(
    'apps/game/src/game-input.ts',
    '  readonly onBuildingRequest: (mode: BuildingToolMode, cell: CellCoord) => void;\n',
    '  readonly onBuildingRequest?: (mode: BuildingToolMode, cell: CellCoord) => void;\n',
)
replace_once(
    'apps/game/src/game-input.ts',
    '        if (request !== null) options.onBuildingRequest(request.mode, request.cell);\n',
    '        if (request !== null) options.onBuildingRequest?.(request.mode, request.cell);\n',
)

replace_once(
    'browser-tests/game.spec.ts',
    "const SAVE_KEY = 'web-three-city:world-save:v2';",
    "const SAVE_KEY = 'web-three-city:world-save:v3';",
)
replace_once(
    'browser-tests/game.spec.ts',
    "    schemaVersion: 2,\n",
    "    schemaVersion: 3,\n    buildings: { schemaVersion: 1 },\n",
)
replace_once(
    'browser-tests/game.spec.ts',
    "  expect(evidence.sceneRootCounts.zonePreview).toBe(0);\n});\n\ntest('boots Coastal Water and Roads",
    "  expect(evidence.sceneRootCounts.zonePreview).toBe(0);\n  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);\n});\n\ntest('boots Coastal Water and Roads",
)
replace_once(
    'browser-tests/game.spec.ts',
    "test('restores exactly one Water and Road root after context restoration'",
    "test('restores exactly one Water, Road, Zone, and Building root after context restoration'",
)
replace_once(
    'browser-tests/game.spec.ts',
    "  expect(evidence.sceneRootCounts.zonePreview).toBe(0);\n});\n\ntest('exposes Terraform, Road, and Zone tools",
    "  expect(evidence.sceneRootCounts.zonePreview).toBe(0);\n  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);\n});\n\ntest('exposes Terraform, Road, Zone, and Building tools",
)
replace_once(
    'browser-tests/game.spec.ts',
    "    'Remove Zone',\n  ]) {",
    "    'Remove Zone',\n    'Develop Zones',\n    'Bulldoze Building',\n  ]) {",
)
replace_once(
    'browser-tests/game.spec.ts',
    "  await page.getByRole('button', { name: 'Raise' }).click();\n",
    "  await page.getByRole('button', { name: 'Develop Zones' }).click();\n  await expect(page.getByTestId('active-tool')).toHaveText('Develop Zones');\n  await expect(page.getByTestId('terraform-brush-controls')).toBeHidden();\n\n  await page.getByRole('button', { name: 'Bulldoze Building' }).click();\n  await expect(page.getByTestId('active-tool')).toHaveText('Bulldoze Building');\n  await expect(page.getByTestId('terraform-brush-controls')).toBeHidden();\n\n  await page.getByRole('button', { name: 'Raise' }).click();\n",
)

replace_once(
    'browser-tests/road.spec.ts',
    "const WORLD_SAVE_KEY = 'web-three-city:world-save:v2';",
    "const WORLD_SAVE_KEY = 'web-three-city:world-save:v3';",
)
replace_once(
    'browser-tests/road.spec.ts',
    "test('WorldSaveV1 restores Roads and legacy Terrain saves migrate to empty Roads'",
    "test('WorldSaveV3 restores Roads and legacy Terrain saves migrate to empty Roads'",
)

print('Finalized Building compatibility migration without running verification')
