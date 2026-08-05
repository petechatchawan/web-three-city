import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(path, source, search, replacement, label = search) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`${path}:missing:${label}`);
  const second = source.indexOf(search, first + search.length);
  if (second >= 0) throw new Error(`${path}:duplicate:${label}`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function edit(path, transform) {
  const before = read(path);
  const after = transform(before);
  if (after === before) throw new Error(`${path}:no-change`);
  write(path, after);
}

write(
  'apps/game/src/game-tool-mode.ts',
  `import type { WorldToolMode } from '@web-three-city/terrain-core';

export type RoadToolMode = 'road-build' | 'road-bulldoze';
export type ZoneToolMode =
  'zone-residential' | 'zone-commercial' | 'zone-industrial' | 'zone-remove';
export type BuildingToolMode = 'building-bulldoze';
export type GameToolMode = WorldToolMode | RoadToolMode | ZoneToolMode | BuildingToolMode;

export function isGameToolMode(mode: string): mode is GameToolMode {
  return (
    mode === 'navigate' ||
    mode === 'raise' ||
    mode === 'lower' ||
    mode === 'flatten' ||
    mode === 'road-build' ||
    mode === 'road-bulldoze' ||
    mode === 'zone-residential' ||
    mode === 'zone-commercial' ||
    mode === 'zone-industrial' ||
    mode === 'zone-remove' ||
    mode === 'building-bulldoze'
  );
}

export function isRoadToolMode(mode: GameToolMode): mode is RoadToolMode {
  return mode === 'road-build' || mode === 'road-bulldoze';
}

export function isZoneToolMode(mode: GameToolMode): mode is ZoneToolMode {
  return (
    mode === 'zone-residential' ||
    mode === 'zone-commercial' ||
    mode === 'zone-industrial' ||
    mode === 'zone-remove'
  );
}

export function isBuildingToolMode(mode: GameToolMode): mode is BuildingToolMode {
  return mode === 'building-bulldoze';
}

export function isTerraformToolMode(
  mode: GameToolMode,
): mode is Exclude<WorldToolMode, 'navigate'> {
  return mode === 'raise' || mode === 'lower' || mode === 'flatten';
}
`,
);

edit('apps/game/src/game-ui.ts', (initial) => {
  let source = initial;
  source = replaceOnce(
    'apps/game/src/game-ui.ts',
    source,
    '  readonly buildingDevelopButton: HTMLButtonElement;\n',
    '',
    'GameUi.buildingDevelopButton',
  );
  source = replaceOnce(
    'apps/game/src/game-ui.ts',
    source,
    "    case 'building-develop':\n      return 'Develop Zones';\n",
    '',
    'toolLabel building-develop',
  );
  source = replaceOnce(
    'apps/game/src/game-ui.ts',
    source,
    '              <button type="button" data-action="tool-building-develop" aria-label="Develop Zones" aria-pressed="false">Develop Zones</button>\n',
    '',
    'Develop Zones markup',
  );
  source = replaceOnce(
    'apps/game/src/game-ui.ts',
    source,
    `  const buildingDevelopButton = requireElement<HTMLButtonElement>(
    root,
    '[data-action="tool-building-develop"]',
  );
`,
    '',
    'Develop Zones lookup',
  );
  source = replaceOnce(
    'apps/game/src/game-ui.ts',
    source,
    "    'building-develop': buildingDevelopButton,\n",
    '',
    'Develop Zones tool button route',
  );
  source = replaceOnce(
    'apps/game/src/game-ui.ts',
    source,
    `              : state.mode === 'building-develop'
                ? 'Release on the world to develop all eligible Zoned lots.'
                : state.mode === 'building-bulldoze'
                  ? 'Release on a Building footprint to bulldoze that Building.'
                  : 'Drag across Terrain and release to apply accepted stamps.';
`,
    `              : state.mode === 'building-bulldoze'
                ? 'Release on a Building footprint to bulldoze that Building.'
                : 'Drag across Terrain and release to apply accepted stamps.';
`,
    'Develop Zones context route',
  );
  source = replaceOnce(
    'apps/game/src/game-ui.ts',
    source,
    '    buildingDevelopButton,\n',
    '',
    'Develop Zones return port',
  );
  return source;
});

edit('apps/game/src/main.ts', (initial) => {
  let source = initial;
  source = replaceOnce(
    'apps/game/src/main.ts',
    source,
    "  'building-develop': 'tool-building-develop',\n",
    '',
    'Develop Zones action',
  );
  source = replaceOnce(
    'apps/game/src/main.ts',
    source,
    "const buildingDevelopButton = requireButton('tool-building-develop');\n",
    '',
    'Develop Zones button lookup',
  );
  source = replaceOnce(
    'apps/game/src/main.ts',
    source,
    `function syncDevelopControl(): void {
  buildingDevelopButton.hidden = automaticGrowthEnabled;
  buildingDevelopButton.setAttribute('aria-hidden', String(automaticGrowthEnabled));
  buildingDevelopButton.tabIndex = automaticGrowthEnabled ? -1 : 0;
}
syncDevelopControl();

`,
    '',
    'hidden Develop Zones synchronization',
  );
  source = replaceOnce(
    'apps/game/src/main.ts',
    source,
    `  setAutomaticGrowthEnabled(enabled: boolean): void {
    automaticGrowthEnabled = enabled;
    syncDevelopControl();
  },
`,
    `  setAutomaticGrowthEnabled(enabled: boolean): void {
    automaticGrowthEnabled = enabled;
  },
`,
    'automatic Growth test switch',
  );
  return source;
});

edit('apps/game/src/game-tool-hud-binding.ts', (initial) =>
  replaceOnce(
    'apps/game/src/game-tool-hud-binding.ts',
    initial,
    '    \'[data-action="tool-building-develop"]\',\n',
    '',
    'Develop Zones HUD mutation selector',
  ),
);

edit('apps/game/src/game-input.ts', (initial) => {
  let source = initial;
  source = replaceOnce(
    'apps/game/src/game-input.ts',
    source,
    "import type { BuildingToolMode } from './game-tool-mode.js';\n",
    '',
    'BuildingToolMode import',
  );
  source = replaceOnce(
    'apps/game/src/game-input.ts',
    source,
    `import {
  isBuildingToolMode,
`,
    `import {
  isBuildingToolMode,
  isGameToolMode,
`,
    'isGameToolMode import',
  );
  source = replaceOnce(
    'apps/game/src/game-input.ts',
    source,
    '  readonly onBuildingRequest?: (mode: BuildingToolMode, cell: CellCoord) => void;\n',
    '  readonly onBuildingBulldoze?: (cell: CellCoord) => void;\n',
    'Building input callback',
  );
  source = replaceOnce(
    'apps/game/src/game-input.ts',
    source,
    '        if (request !== null) options.onBuildingRequest?.(request.mode, request.cell);\n',
    '        if (request !== null) options.onBuildingBulldoze?.(request.cell);\n',
    'Building input release route',
  );
  source = replaceOnce(
    'apps/game/src/game-input.ts',
    source,
    `      if (
        value !== 'navigate' &&
        value !== 'raise' &&
        value !== 'lower' &&
        value !== 'flatten' &&
        value !== 'road-build' &&
        value !== 'road-bulldoze' &&
        value !== 'zone-residential' &&
        value !== 'zone-commercial' &&
        value !== 'zone-industrial' &&
        value !== 'zone-remove' &&
        value !== 'building-develop' &&
        value !== 'building-bulldoze'
      ) {
        throw new RangeError('game-input:invalid-tool-mode');
      }
`,
    `      if (!isGameToolMode(value)) {
        throw new RangeError('game-input:invalid-tool-mode');
      }
`,
    'production tool validation',
  );
  return source;
});

edit('apps/game/src/game-bootstrap.ts', (initial) => {
  let source = initial;
  source = replaceOnce(
    'apps/game/src/game-bootstrap.ts',
    source,
    '  planBuildingDevelopment,\n',
    '',
    'interactive development planner import',
  );
  source = replaceOnce(
    'apps/game/src/game-bootstrap.ts',
    source,
    "import type { BuildingToolMode, GameToolMode } from './game-tool-mode.js';\n",
    "import type { GameToolMode } from './game-tool-mode.js';\n",
    'BuildingToolMode import',
  );
  source = replaceOnce(
    'apps/game/src/game-bootstrap.ts',
    source,
    `function statusForBuildingPlan(plan: BuildingMutationPlan): string {
  if (plan.valid) return plan.operation === 'develop' ? 'Zones developed' : 'Building bulldozed';
  if (plan.invalidReason === 'building:no-zoned-lot') return 'No eligible Zoned lots';
  if (plan.invalidReason === 'building:not-found') return 'No building selected';
  if (plan.invalidReason === 'building:road-access-required') return 'Building needs Road frontage';
  if (plan.invalidReason === 'building:mixed-zone') return 'Building lot spans mixed Zones';
  if (plan.invalidReason === 'building:wet-cell') return 'Building blocked by water';
  if (plan.invalidReason === 'building:unsupported-terrain')
    return 'Building requires flat terrain';
  return 'Building rejected';
}
`,
    `function statusForBuildingBulldozePlan(plan: BuildingMutationPlan): string {
  if (plan.valid) return 'Building bulldozed';
  if (plan.invalidReason === 'building:not-found') return 'No building selected';
  return 'Building bulldoze rejected';
}
`,
    'interactive Building status',
  );
  source = replaceOnce(
    'apps/game/src/game-bootstrap.ts',
    source,
    `  const commitBuildingPlan = (plan: BuildingMutationPlan): void => {
    buildingInvalidReason = plan.invalidReason;
    if (!plan.valid) {
      ui.setStatus(statusForBuildingPlan(plan));
      ui.setUndoAvailable(undoStore.available);
      return;
    }
    const before = buildingsSnapshot;
    dispatchGameTransactionState(ui.canvas, 'committing', 'building');
    try {
      const committed = commitBuildingMutation(
        buildingsSnapshot,
        plan,
        buildingEnvironment,
        WORLD_CONFIG,
      );
      buildingsSnapshot = committed.snapshot;
      buildingPresentation.load(buildingsSnapshot);
      zoneEnvironment = createZonePlacementEnvironment(
        snapshot,
        waterSnapshot,
        roadsSnapshot,
        createBuildingWorldOccupancy(buildingsSnapshot),
        WORLD_CONFIG,
      );
      undoStore.replace({ kind: 'building', buildings: before });
      if (plan.operation === 'develop') buildingCommitCount += 1;
      else buildingBulldozeCount += 1;
      buildingInvalidReason = null;
      ui.setBuildingCount(buildingCount(buildingsSnapshot));
      ui.setStatus(statusForBuildingPlan(plan));
    } catch {
      ui.setStatus('Building update failed');
    }
    ui.setUndoAvailable(undoStore.available);
  };

  const applyBuildingRequest = (mode: BuildingToolMode, cell: CellCoord): void => {
    const plan =
      mode === 'building-develop'
        ? planBuildingDevelopment(buildingsSnapshot, buildingEnvironment, WORLD_CONFIG)
        : planBuildingBulldoze(buildingsSnapshot, cell, buildingEnvironment, WORLD_CONFIG);
    commitBuildingPlan(plan);
  };
`,
    `  const commitBuildingBulldozePlan = (plan: BuildingMutationPlan): void => {
    if (plan.operation !== 'bulldoze') {
      throw new Error('game:interactive-building-operation-must-be-bulldoze');
    }
    buildingInvalidReason = plan.invalidReason;
    if (!plan.valid) {
      ui.setStatus(statusForBuildingBulldozePlan(plan));
      ui.setUndoAvailable(undoStore.available);
      return;
    }
    const before = buildingsSnapshot;
    dispatchGameTransactionState(ui.canvas, 'committing', 'building');
    try {
      const committed = commitBuildingMutation(
        buildingsSnapshot,
        plan,
        buildingEnvironment,
        WORLD_CONFIG,
      );
      buildingsSnapshot = committed.snapshot;
      buildingPresentation.load(buildingsSnapshot);
      zoneEnvironment = createZonePlacementEnvironment(
        snapshot,
        waterSnapshot,
        roadsSnapshot,
        createBuildingWorldOccupancy(buildingsSnapshot),
        WORLD_CONFIG,
      );
      undoStore.replace({ kind: 'building', buildings: before });
      buildingBulldozeCount += 1;
      buildingInvalidReason = null;
      ui.setBuildingCount(buildingCount(buildingsSnapshot));
      ui.setStatus(statusForBuildingBulldozePlan(plan));
    } catch {
      ui.setStatus('Building update failed');
    }
    ui.setUndoAvailable(undoStore.available);
  };

  const applyBuildingBulldozeRequest = (cell: CellCoord): void => {
    commitBuildingBulldozePlan(
      planBuildingBulldoze(buildingsSnapshot, cell, buildingEnvironment, WORLD_CONFIG),
    );
  };
`,
    'interactive Building transaction path',
  );
  source = replaceOnce(
    'apps/game/src/game-bootstrap.ts',
    source,
    '    onBuildingRequest: applyBuildingRequest,\n',
    '    onBuildingBulldoze: applyBuildingBulldozeRequest,\n',
    'Building input port',
  );
  source = replaceOnce(
    'apps/game/src/game-bootstrap.ts',
    source,
    `  ui.buildingDevelopButton.addEventListener(
    'click',
    () => setToolMode('building-develop'),
    listenerOptions,
  );
`,
    '',
    'Develop Zones bootstrap listener',
  );
  return source;
});

write(
  'apps/game/src/game-tool-mode-building.test.ts',
  `import { describe, expect, it } from 'vitest';
import {
  isBuildingToolMode,
  isGameToolMode,
  isRoadToolMode,
  isTerraformToolMode,
  isZoneToolMode,
  type GameToolMode,
} from './game-tool-mode.js';

const MODES: readonly GameToolMode[] = Object.freeze([
  'navigate',
  'raise',
  'lower',
  'flatten',
  'road-build',
  'road-bulldoze',
  'zone-residential',
  'zone-commercial',
  'zone-industrial',
  'zone-remove',
  'building-bulldoze',
]);

describe('Building tool modes', () => {
  it('exposes only interactive Building bulldoze', () => {
    expect(MODES.filter(isBuildingToolMode)).toEqual(['building-bulldoze']);
    expect(isGameToolMode('building-develop')).toBe(false);
  });

  it('keeps Building bulldoze isolated from Terrain, Road, and Zone domains', () => {
    expect(isTerraformToolMode('building-bulldoze')).toBe(false);
    expect(isRoadToolMode('building-bulldoze')).toBe(false);
    expect(isZoneToolMode('building-bulldoze')).toBe(false);
  });
});
`,
);

edit('browser-tests/growth.spec.ts', (initial) => {
  let source = initial;
  source = replaceOnce(
    'browser-tests/growth.spec.ts',
    source,
    `  await expect(page.getByTestId('active-tool')).toHaveText('Industrial Zone');
  await expect(industrialButton).toHaveAttribute('aria-pressed', 'true');

`,
    `  await expect(page.getByTestId('active-tool')).toHaveText('Industrial Zone');
  await expect(industrialButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toHaveCount(0);

`,
    'active Growth production graph assertion',
  );
  source = replaceOnce(
    'browser-tests/growth.spec.ts',
    source,
    `    const develop = document.querySelector<HTMLButtonElement>(
      '[data-action="tool-building-develop"]',
    );
`,
    '',
    'Develop Zones probe lookup',
  );
  source = replaceOnce(
    'browser-tests/growth.spec.ts',
    source,
    '    if (canvas === null || navigate === null || develop === null || status === null) {\n',
    '    if (canvas === null || navigate === null || status === null) {\n',
    'isolation probe target guard',
  );
  source = replaceOnce(
    'browser-tests/growth.spec.ts',
    source,
    '      developClicks: 0,\n',
    '',
    'Develop Zones click counter',
  );
  source = replaceOnce(
    'browser-tests/growth.spec.ts',
    source,
    `    develop.addEventListener('click', () => {
      probe.developClicks += 1;
    });
`,
    '',
    'Develop Zones click probe',
  );
  source = replaceOnce(
    'browser-tests/growth.spec.ts',
    source,
    '          readonly developClicks: number;\n',
    '',
    'Develop Zones probe type',
  );
  source = replaceOnce(
    'browser-tests/growth.spec.ts',
    source,
    '  expect(probe.developClicks).toBe(0);\n',
    '',
    'Develop Zones probe assertion',
  );
  source = replaceOnce(
    'browser-tests/growth.spec.ts',
    source,
    `  await expect(page.getByRole('button', { name: 'Develop Zones' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Bulldoze Building' })).toBeVisible();
`,
    `  await expect(page.getByRole('button', { name: 'Develop Zones' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bulldoze Building' })).toBeVisible();
`,
    'production Develop Zones absence',
  );
  return source;
});

write(
  'browser-tests/building.spec.ts',
  `import { expect, test, type Page } from '@playwright/test';
import {
  BUILDING_FIXTURES,
  pointFor,
  prepareBuildingFixtureWorld,
} from './helpers/building-fixture.js';
import {
  prepareDeterministicGrowthClock,
  stepLogicalTicks,
} from './helpers/growth-fixture.js';
import { GAME_URL, readEvidence } from './helpers/interaction.js';

const SAVE_KEY = 'web-three-city:world-save:v3';
const EXPECTED_DEFINITION_IDS = Object.freeze([
  'commercial-office-2x2',
  'industrial-factory-2x2',
  'residential-apartment-2x2',
]);

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  await prepareDeterministicGrowthClock(page);
}

async function growAllEligibleBuildings(page: Page): Promise<void> {
  const snapshot = await stepLogicalTicks(page, 16);
  expect(snapshot.simulation.absoluteTick).toBe(24);
  expect(snapshot.buildingCount).toBe(3);
  await expect(page.getByTestId('building-count')).toHaveText('3');
}

async function setAutomaticGrowthEnabled(page: Page, enabled: boolean): Promise<void> {
  await page.evaluate((value) => {
    const timeWindow = window as Window & {
      __WEB_THREE_CITY_TIME__?: {
        setAutomaticGrowthEnabled(enabled: boolean): void;
      };
    };
    const api = timeWindow.__WEB_THREE_CITY_TIME__;
    if (api === undefined) throw new Error('building:missing-time-api');
    api.setAutomaticGrowthEnabled(value);
  }, enabled);
}

test('exposes headless Building Growth and interactive Bulldoze evidence', async ({ page }) => {
  await openGame(page);
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bulldoze Building' })).toBeVisible();
  await expect(page.getByTestId('building-count')).toHaveText('0');
  const evidence = await readEvidence(page);
  expect(evidence.building.committedBuildingRevision).toBe(0);
  expect(evidence.building.count).toBe(0);
  expect(evidence.building.definitionIds).toEqual([]);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
});

test('headless Growth fails closed before eligible Zones exist', async ({ page }) => {
  await openGame(page);
  const statusBeforeGrowth = (await page.getByTestId('game-status').textContent()) ?? '';
  const snapshot = await stepLogicalTicks(page, 4);

  expect(snapshot.simulation.absoluteTick).toBe(12);
  expect(snapshot.buildingCount).toBe(0);
  await expect(page.getByTestId('building-count')).toHaveText('0');
  await expect(page.getByTestId('active-tool')).toHaveText('Navigate');
  await expect(page.getByTestId('game-status')).toHaveText(statusBeforeGrowth);
  await expect(page.getByTestId('game-status')).not.toHaveText('Zones developed');
});

test('grows deterministic R/C/I content and preserves authority across guards, Undo, and Save V3', async ({
  page,
}) => {
  await openGame(page);
  const points = await prepareBuildingFixtureWorld(page);
  await growAllEligibleBuildings(page);

  let evidence = await readEvidence(page);
  expect(evidence.zone.counts).toEqual({
    residential: 4,
    commercial: 4,
    industrial: 4,
    total: 12,
  });
  expect(evidence.building.count).toBe(3);
  expect(evidence.building.occupiedCellCount).toBe(12);
  expect(evidence.building.definitionIds).toEqual(EXPECTED_DEFINITION_IDS);
  expect(evidence.building.commitCount).toBe(3);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
  await expect(page.getByTestId('building-count')).toHaveText('3');

  const commercialFrontCell = pointFor(points, BUILDING_FIXTURES.commercial.zoneCells[0]);
  const commercialBackCell = pointFor(points, BUILDING_FIXTURES.commercial.zoneCells[2]);

  await page.getByRole('button', { name: 'Build Road' }).click();
  await page.mouse.click(commercialFrontCell.x, commercialFrontCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Road blocked by building');

  await page.getByRole('button', { name: 'Remove Zone' }).click();
  await page.mouse.click(commercialFrontCell.x, commercialFrontCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Zone blocked by building');

  // Use the back row of the 2x2 footprint so the Terraform vertex set touches the Building
  // without also touching its frontage Road. Road occupancy has intentionally higher precedence.
  await page.getByRole('button', { name: 'Raise' }).click();
  await page.mouse.click(commercialBackCell.x, commercialBackCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Terraform blocked by building');

  await page.getByRole('button', { name: 'Bulldoze Road' }).click();
  const firstRoad = pointFor(points, BUILDING_FIXTURES.commercial.roadCells[0]);
  const secondRoad = pointFor(points, BUILDING_FIXTURES.commercial.roadCells[1]);
  await page.mouse.move(firstRoad.x, firstRoad.y);
  await page.mouse.down();
  await page.mouse.move(secondRoad.x, secondRoad.y);
  await page.mouse.up();
  await expect(page.getByTestId('game-status')).toHaveText('Road required by building');

  evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(3);
  expect(evidence.zone.counts.commercial).toBe(4);

  await setAutomaticGrowthEnabled(page, false);
  await page.getByRole('button', { name: 'Save world' }).click();
  const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  expect(JSON.parse(saved ?? '{}')).toMatchObject({
    kind: 'world-save',
    schemaVersion: 3,
    buildings: {
      kind: 'building-save',
      schemaVersion: 1,
      instances: expect.arrayContaining([
        expect.objectContaining({ buildingDefinitionId: 'commercial-office-2x2' }),
        expect.objectContaining({ buildingDefinitionId: 'industrial-factory-2x2' }),
        expect.objectContaining({ buildingDefinitionId: 'residential-apartment-2x2' }),
      ]),
    },
  });

  await page.getByRole('button', { name: 'Bulldoze Building' }).click();
  await page.mouse.click(commercialFrontCell.x, commercialFrontCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Building bulldozed');
  evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(2);
  expect(evidence.building.occupiedCellCount).toBe(8);
  expect(evidence.building.definitionIds).not.toContain('commercial-office-2x2');
  expect(evidence.zone.counts.commercial).toBe(4);

  await page.getByRole('button', { name: 'Undo latest world change' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Building undone');
  evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(3);
  expect(evidence.building.definitionIds).toEqual(EXPECTED_DEFINITION_IDS);
  expect(evidence.building.undoCount).toBe(1);

  await page.getByRole('button', { name: 'Bulldoze Building' }).click();
  await page.mouse.click(commercialFrontCell.x, commercialFrontCell.y);
  await expect(page.getByTestId('game-status')).toHaveText('Building bulldozed');
  await page.getByRole('button', { name: 'Load world' }).click();
  await expect(page.getByTestId('game-status')).toHaveText('Loaded');
  evidence = await readEvidence(page);
  expect(evidence.building.count).toBe(3);
  expect(evidence.building.definitionIds).toEqual(EXPECTED_DEFINITION_IDS);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
});
`,
);

write(
  'browser-tests/building-visual-evidence.spec.ts',
  `import { expect, test } from '@playwright/test';
import { prepareBuildingFixtureWorld } from './helpers/building-fixture.js';
import {
  prepareDeterministicGrowthClock,
  stepLogicalTicks,
} from './helpers/growth-fixture.js';
import { GAME_URL, readEvidence } from './helpers/interaction.js';

test('captures deterministic Residential, Commercial, and Industrial prototypes', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  await prepareDeterministicGrowthClock(page);
  await prepareBuildingFixtureWorld(page);

  const snapshot = await stepLogicalTicks(page, 40);
  expect(snapshot.simulation.absoluteTick).toBe(48);
  expect(snapshot.buildingCount).toBe(3);
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toHaveCount(0);

  const evidence = await readEvidence(page);
  expect(evidence.building.definitionIds).toEqual([
    'commercial-office-2x2',
    'industrial-factory-2x2',
    'residential-apartment-2x2',
  ]);
  await page.screenshot({
    path: testInfo.outputPath('building-foundation-rci-prototypes.png'),
    fullPage: true,
  });
});
`,
);

const productionGraphFiles = [
  'apps/game/src/game-tool-mode.ts',
  'apps/game/src/game-ui.ts',
  'apps/game/src/main.ts',
  'apps/game/src/game-tool-hud-binding.ts',
  'apps/game/src/game-input.ts',
  'apps/game/src/game-bootstrap.ts',
];
for (const path of productionGraphFiles) {
  const source = read(path);
  for (const forbidden of [
    'building-develop',
    'tool-building-develop',
    'Develop Zones',
    'Zones developed',
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`${path}:forbidden-production-route:${forbidden}`);
    }
  }
}

for (const path of [
  'browser-tests/building.spec.ts',
  'browser-tests/building-visual-evidence.spec.ts',
]) {
  if (read(path).includes(".getByRole('button', { name: 'Develop Zones' }).click()")) {
    throw new Error(`${path}:interactive-develop-test-route-remains`);
  }
}

console.log('Headless Automatic Growth remediation applied.');
