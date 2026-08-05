import { readFile, writeFile } from 'node:fs/promises';

async function replaceExact(path, before, after) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`growth-reservation-fix:missing-pattern:${path}:${before.slice(0, 80)}`);
  }
  const next = source.replace(before, after);
  if (next === source) throw new Error(`growth-reservation-fix:no-change:${path}`);
  await writeFile(path, next);
}

await replaceExact(
  'packages/building-core/src/building-selection.ts',
  `  readonly absoluteTick: number;\n  readonly growthSequence: number;\n}): BuildingSelectionCandidate | null {\n  const occupied = new Set<string>();`,
  `  readonly absoluteTick: number;\n  readonly growthSequence: number;\n  readonly reservedCells?: readonly CellCoord[];\n}): BuildingSelectionCandidate | null {\n  const occupied = new Set<string>();`,
);
await replaceExact(
  'packages/building-core/src/building-selection.ts',
  `  for (const instance of input.buildings.instances) {\n    for (const cell of occupiedCellsForBuilding(instance)) occupied.add(key(cell));\n  }\n\n  for (let z = 0; z < input.config.mapHeight; z += 1) {`,
  `  for (const instance of input.buildings.instances) {\n    for (const cell of occupiedCellsForBuilding(instance)) occupied.add(key(cell));\n  }\n  const reserved = new Set((input.reservedCells ?? []).map(key));\n\n  for (let z = 0; z < input.config.mapHeight; z += 1) {`,
);
await replaceExact(
  'packages/building-core/src/building-selection.ts',
  `                !inside(cell, input.config) ||\n                occupied.has(key(cell)) ||\n                input.environment.zoneDefinitionIdAt(cell) !== zoneDefinitionId ||`,
  `                !inside(cell, input.config) ||\n                occupied.has(key(cell)) ||\n                reserved.has(key(cell)) ||\n                input.environment.zoneDefinitionIdAt(cell) !== zoneDefinitionId ||`,
);
await replaceExact(
  'packages/building-core/src/building-selection.ts',
  `          const frontage = resolveBuildingFrontage(instance, input.environment);\n          if (frontage !== null) candidates.push(Object.freeze({ definition, instance, frontage }));`,
  `          const frontage = resolveBuildingFrontage(instance, input.environment);\n          if (\n            frontage !== null &&\n            !reserved.has(key(frontage.frontageCell)) &&\n            !reserved.has(key(frontage.roadCell))\n          ) {\n            candidates.push(Object.freeze({ definition, instance, frontage }));\n          }`,
);

await replaceExact(
  'packages/building-core/src/building-growth.ts',
  `import type { WorldConfig } from '@web-three-city/world-core';`,
  `import type { CellCoord, WorldConfig } from '@web-three-city/world-core';`,
);
await replaceExact(
  'packages/building-core/src/building-growth.ts',
  `  readonly environment: BuildingDevelopmentEnvironment;\n  readonly config: WorldConfig;\n}): BuildingGrowthPlan {`,
  `  readonly environment: BuildingDevelopmentEnvironment;\n  readonly config: WorldConfig;\n  readonly reservedCells?: readonly CellCoord[];\n}): BuildingGrowthPlan {`,
);
await replaceExact(
  'packages/building-core/src/building-growth.ts',
  `      absoluteTick: afterAbsoluteTick,\n      growthSequence: simulation.growthSequence,\n    });`,
  `      absoluteTick: afterAbsoluteTick,\n      growthSequence: simulation.growthSequence,\n      reservedCells: input.reservedCells,\n    });`,
);

await replaceExact(
  'apps/game/src/world-growth-transaction.ts',
  `import type { WorldConfig } from '@web-three-city/world-core';`,
  `import type { CellCoord, WorldConfig } from '@web-three-city/world-core';`,
);
await replaceExact(
  'apps/game/src/world-growth-transaction.ts',
  `  readonly environment: BuildingDevelopmentEnvironment;\n  readonly config: WorldConfig;\n}): WorldGrowthTickResult {`,
  `  readonly environment: BuildingDevelopmentEnvironment;\n  readonly config: WorldConfig;\n  readonly reservedCells?: readonly CellCoord[];\n}): WorldGrowthTickResult {`,
);
await replaceExact(
  'apps/game/src/world-growth-transaction.ts',
  `    environment: input.environment,\n    config: input.config,\n  });`,
  `    environment: input.environment,\n    config: input.config,\n    reservedCells: input.reservedCells,\n  });`,
);

await replaceExact(
  'apps/game/src/game-input.ts',
  `  getZoneState(): ZoneInputState;\n  getBuildingState(): BuildingInputState;\n  clearActiveSession(): void;`,
  `  getZoneState(): ZoneInputState;\n  getBuildingState(): BuildingInputState;\n  getBackgroundGrowthReservations(): readonly CellCoord[];\n  clearActiveSession(): void;`,
);
await replaceExact(
  'apps/game/src/game-input.ts',
  `  let mode: GameToolMode = 'navigate';\n  let brushSize: TerraformBrushSize = 1;\n\n  const refreshTerrainObjects = (): void => {`,
  `  let mode: GameToolMode = 'navigate';\n  let brushSize: TerraformBrushSize = 1;\n  let backgroundGrowthReservations: readonly CellCoord[] = Object.freeze([]);\n\n  const setBackgroundGrowthReservations = (cells: readonly CellCoord[]): void => {\n    const unique = new Map<string, CellCoord>();\n    for (const cell of cells) unique.set(\`${cell.x}:${cell.z}\`, cell);\n    backgroundGrowthReservations = Object.freeze(\n      [...unique.values()]\n        .sort((first, second) => first.z - second.z || first.x - second.x)\n        .map((cell) => Object.freeze({ x: cell.x, z: cell.z })),\n    );\n  };\n\n  const refreshTerrainObjects = (): void => {`,
);
await replaceExact(
  'apps/game/src/game-input.ts',
  `    onState(state): void {\n      options.preview.show(`,
  `    onState(state): void {\n      const reservationCells =\n        state.acceptedPlan?.affectedCells ??\n        (state.currentStamp.kind === 'rejected' || state.currentStamp.kind === 'no-change'\n          ? state.currentStamp.preview.corePlan.affectedCells\n          : Object.freeze([]));\n      setBackgroundGrowthReservations(state.strokeActive ? reservationCells : Object.freeze([]));\n      options.preview.show(`,
);
await replaceExact(
  'apps/game/src/game-input.ts',
  `    onPreview(baseRoads, plan, environment): void {\n      const candidate = baseRoads === null || plan === null ? null : guardRoad(plan, baseRoads);`,
  `    onPreview(baseRoads, plan, environment): void {\n      setBackgroundGrowthReservations(plan?.requestedCells ?? Object.freeze([]));\n      const candidate = baseRoads === null || plan === null ? null : guardRoad(plan, baseRoads);`,
);
await replaceExact(
  'apps/game/src/game-input.ts',
  `    onPreview(baseZones, plan): void {\n      const candidate =`,
  `    onPreview(baseZones, plan): void {\n      setBackgroundGrowthReservations(plan?.requestedCells ?? Object.freeze([]));\n      const candidate =`,
);
await replaceExact(
  'apps/game/src/game-input.ts',
  `      if (isRoadToolMode(mode)) return roadController.begin(pointerId, cell);\n      if (isZoneToolMode(mode)) return zoneController.begin(pointerId, cell);\n      if (isBuildingToolMode(mode)) return buildingController.begin(pointerId, cell);`,
  `      if (isRoadToolMode(mode)) return roadController.begin(pointerId, cell);\n      if (isZoneToolMode(mode)) return zoneController.begin(pointerId, cell);\n      if (isBuildingToolMode(mode)) {\n        const started = buildingController.begin(pointerId, cell);\n        if (started) setBackgroundGrowthReservations([cell]);\n        return started;\n      }`,
);
await replaceExact(
  'apps/game/src/game-input.ts',
  `      else if (isZoneToolMode(mode)) zoneController.move(pointerId, cell);\n      else if (isBuildingToolMode(mode)) buildingController.move(pointerId, cell);\n      else if (isTerraformToolMode(mode)) terraformSession.move(pointerId, cell);`,
  `      else if (isZoneToolMode(mode)) zoneController.move(pointerId, cell);\n      else if (isBuildingToolMode(mode)) {\n        buildingController.move(pointerId, cell);\n        setBackgroundGrowthReservations([cell]);\n      } else if (isTerraformToolMode(mode)) terraformSession.move(pointerId, cell);`,
);
await replaceExact(
  'apps/game/src/game-input.ts',
  `      if (isBuildingToolMode(mode)) {\n        const request = buildingController.end(pointerId, cell);\n        if (request !== null) options.onBuildingBulldoze?.(request.cell);\n        return;\n      }`,
  `      if (isBuildingToolMode(mode)) {\n        const request = buildingController.end(pointerId, cell);\n        setBackgroundGrowthReservations(Object.freeze([]));\n        if (request !== null) options.onBuildingBulldoze?.(request.cell);\n        return;\n      }`,
);
await replaceExact(
  'apps/game/src/game-input.ts',
  `      buildingController.cancel(pointerId);\n      terraformSession.cancel(pointerId);\n    },\n    cancelAll(): void {\n      roadController.cancelAll();\n      zoneController.cancelAll();\n      buildingController.cancelAll();\n      terraformSession.cancelAll();\n    },`,
  `      buildingController.cancel(pointerId);\n      terraformSession.cancel(pointerId);\n      setBackgroundGrowthReservations(Object.freeze([]));\n    },\n    cancelAll(): void {\n      roadController.cancelAll();\n      zoneController.cancelAll();\n      buildingController.cancelAll();\n      terraformSession.cancelAll();\n      setBackgroundGrowthReservations(Object.freeze([]));\n    },`,
);
await replaceExact(
  'apps/game/src/game-input.ts',
  `    terraformSession.cancelAll();\n  };\n  const toolEventController`,
  `    terraformSession.cancelAll();\n    setBackgroundGrowthReservations(Object.freeze([]));\n  };\n  const toolEventController`,
);
await replaceExact(
  'apps/game/src/game-input.ts',
  `    getBuildingState(): BuildingInputState {\n      return buildingController.getState();\n    },\n    clearActiveSession(): void {`,
  `    getBuildingState(): BuildingInputState {\n      return buildingController.getState();\n    },\n    getBackgroundGrowthReservations(): readonly CellCoord[] {\n      return backgroundGrowthReservations;\n    },\n    clearActiveSession(): void {`,
);

await replaceExact(
  'apps/game/src/game-bootstrap.ts',
  `      environment: buildingEnvironment,\n      config: WORLD_CONFIG,\n    });`,
  `      environment: buildingEnvironment,\n      config: WORLD_CONFIG,\n      reservedCells: inputRef.current?.getBackgroundGrowthReservations() ?? Object.freeze([]),\n    });`,
);

await replaceExact(
  'packages/building-core/test/building-growth-reservation.test.ts',
  `    const input = {\n      buildings,\n      simulation,\n      environment: environment(),\n      config: CONFIG,\n      reservedCells: Object.freeze([Object.freeze({ x: 0, z: 0 })]),\n    } as Parameters<typeof planBuildingGrowthTick>[0];`,
  `    const input = {\n      buildings,\n      simulation,\n      environment: environment(),\n      config: CONFIG,\n      reservedCells: Object.freeze([Object.freeze({ x: 0, z: 0 })]),\n    };`,
);

const browserRegression = `import { expect, test } from '@playwright/test';\nimport {\n  BUILDING_FIXTURES,\n  pointFor,\n  prepareBuildingFixtureWorld,\n} from './helpers/building-fixture.js';\nimport {\n  prepareDeterministicGrowthClock,\n  readTimeSnapshot,\n} from './helpers/growth-fixture.js';\nimport { GAME_URL } from './helpers/interaction.js';\n\ntest('active Zone removal commits after background Growth skips its reserved cells', async ({\n  page,\n}) => {\n  await page.setViewportSize({ width: 1440, height: 900 });\n  await page.goto(GAME_URL);\n  await expect(page.getByTestId('game-status')).toHaveText('Ready');\n  await prepareDeterministicGrowthClock(page);\n  const points = await prepareBuildingFixtureWorld(page);\n\n  const removeButton = page.getByRole('button', { name: 'Remove Zone' });\n  await removeButton.click();\n  const start = pointFor(points, BUILDING_FIXTURES.residential.zoneCells[0]);\n  const end = pointFor(points, BUILDING_FIXTURES.residential.zoneCells[1]);\n  await page.mouse.move(start.x, start.y);\n  await page.mouse.down();\n  await page.mouse.move(end.x, end.y);\n  await expect\n    .poll(() =>\n      page.evaluate(() => window.__WEB_THREE_CITY_INTERACTION__?.zone.strokeActive ?? false),\n    )\n    .toBe(true);\n\n  await page.evaluate(() => {\n    const api = (window as Window & {\n      __WEB_THREE_CITY_TIME__?: {\n        setSpeed(speed: 'paused' | 'normal' | 'fast' | 'faster'): void;\n      };\n    }).__WEB_THREE_CITY_TIME__;\n    if (api === undefined) throw new Error('growth-reservation:missing-time-api');\n    api.setSpeed('faster');\n  });\n  await expect\n    .poll(async () => (await readTimeSnapshot(page)).simulation.absoluteTick, { timeout: 5_000 })\n    .toBeGreaterThanOrEqual(12);\n  await page.evaluate(() => {\n    const api = (window as Window & {\n      __WEB_THREE_CITY_TIME__?: {\n        setSpeed(speed: 'paused' | 'normal' | 'fast' | 'faster'): void;\n      };\n    }).__WEB_THREE_CITY_TIME__;\n    if (api === undefined) throw new Error('growth-reservation:missing-time-api');\n    api.setSpeed('paused');\n  });\n\n  await expect(page.getByTestId('active-tool')).toHaveText('Remove Zone');\n  await expect(removeButton).toHaveAttribute('aria-pressed', 'true');\n  await page.mouse.up();\n  await expect(page.getByTestId('game-status')).toHaveText('Zone removed');\n  await expect(page.getByTestId('game-status')).not.toHaveText('Building rejected');\n  await expect(page.getByTestId('game-status')).not.toHaveText('Zone blocked by building');\n  await expect(page.getByTestId('zone-residential-count')).toHaveText('2');\n  await expect(page.getByTestId('active-tool')).toHaveText('Remove Zone');\n  await expect(removeButton).toHaveAttribute('aria-pressed', 'true');\n});\n`;
await writeFile('browser-tests/growth-reservation.spec.ts', browserRegression);
