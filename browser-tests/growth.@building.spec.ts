import { expect, test } from '@playwright/test';
import {
  BUILDING_FIXTURES,
  pointFor,
  prepareBuildingFixtureWorld,
} from './helpers/building-fixture.js';
import { expandToolContext, openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import {
  prepareDeterministicGrowthClock,
  readTimeSnapshot,
  stepLogicalMinutes,
  stepLogicalTicks,
} from './helpers/growth-fixture.js';
import { GAME_URL, clickGameMenuAction } from './helpers/interaction.js';

test.describe.configure({ timeout: 60_000 });

const SAVE_KEY = 'web-three-city:world-save:v8';

async function openGrowthGame(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
  await prepareDeterministicGrowthClock(page);
}

test('exposes the simple calendar and deterministic time controls', async ({ page }) => {
  await openGrowthGame(page);
  await expect(page.locator('[data-metric="gameTime"] strong')).toHaveText('Y1 M1 08:00');
  const paused = page.locator('[data-simulation-speed="paused"]');
  const normal = page.locator('[data-simulation-speed="normal"]');
  const fast = page.locator('[data-simulation-speed="fast"]');
  const faster = page.locator('[data-simulation-speed="faster"]');
  await expect(paused).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-simulation-step]')).toBeEnabled();

  await normal.click();
  await expect(normal).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-simulation-step]')).toHaveCount(0);
  await expect
    .poll(() => page.locator('[data-metric="gameTime"] strong').textContent(), {
      timeout: 4_000,
      message: 'automatic simulation must refresh the visible calendar',
    })
    .not.toBe('Y1 M1 08:00');
  await fast.click();
  await expect(fast).toHaveAttribute('aria-pressed', 'true');
  await faster.click();
  await expect(faster).toHaveAttribute('aria-pressed', 'true');
  await paused.click();
  await expect(paused).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-simulation-step]')).toBeEnabled();

  // Running speeds can legitimately advance wall-clock driven ticks. Reset the
  // deterministic clock before asserting Step semantics.
  await prepareDeterministicGrowthClock(page);
  const after = await stepLogicalTicks(page, 1);
  expect(after.simulation.absoluteTick).toBe(9);
  expect(after.speed).toBe('paused');
  await expect(page.locator('[data-metric="gameTime"] strong')).toHaveText('Y1 M1 09:00');
});

test('production playback crosses compressed hour and month boundaries with Growth enabled', async ({
  page,
}) => {
  // This regression deliberately advances every logical minute from the
  // deterministic start to both boundaries. Keep the budget local to this
  // production-path test; do not broaden the suite or browser worker budget.
  test.setTimeout(180_000);
  await openGrowthGame(page);
  await prepareBuildingFixtureWorld(page);

  let before = await stepLogicalMinutes(page, 11 * 60 + 59 - 8 * 60);
  expect(before.simulation.absoluteGameMinute).toBe(11 * 60 + 59);
  const normal = page.locator('[data-simulation-speed="normal"]');
  await normal.click();
  await expect
    .poll(() => readTimeSnapshot(page).then((snapshot) => snapshot.simulation.absoluteGameMinute), {
      timeout: 4_000,
      message: 'production runtime must cross 11:59 → 12:00',
    })
    .toBeGreaterThanOrEqual(12 * 60);
  await page.locator('[data-simulation-speed="paused"]').click();
  let after = await readTimeSnapshot(page);
  expect(after.simulation.absoluteGameMinute).toBeGreaterThanOrEqual(12 * 60);
  expect(after.revision - before.revision).toBe(
    (after.simulation.absoluteGameMinute - before.simulation.absoluteGameMinute) * 5,
  );
  expect(after.buildingCount).toBeGreaterThan(before.buildingCount);

  await page.goto(GAME_URL);
  await waitForCityUi(page);
  await prepareDeterministicGrowthClock(page);
  await prepareBuildingFixtureWorld(page);

  before = await stepLogicalMinutes(page, 23 * 60 + 59 - 8 * 60);
  expect(before.simulation.absoluteGameMinute).toBe(23 * 60 + 59);
  await page.locator('[data-simulation-speed="normal"]').click();
  await expect
    .poll(() => readTimeSnapshot(page).then((snapshot) => snapshot.simulation.absoluteGameMinute), {
      timeout: 4_000,
      message: 'production runtime must cross 23:59 → 00:00',
    })
    .toBeGreaterThanOrEqual(24 * 60);
  await page.locator('[data-simulation-speed="paused"]').click();
  after = await readTimeSnapshot(page);
  expect(after.simulation.absoluteGameMinute).toBeGreaterThanOrEqual(24 * 60);
  expect(after.revision - before.revision).toBe(
    (after.simulation.absoluteGameMinute - before.simulation.absoluteGameMinute) * 5,
  );
  expect(after.buildingCount).toBeGreaterThan(before.buildingCount);
});

test('projects compressed month and year boundaries without rejecting the minute', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await openGrowthGame(page);
  await prepareDeterministicGrowthClock(page);

  let before = await stepLogicalMinutes(page, 1439 - 8 * 60);
  expect(before.simulation.absoluteGameMinute).toBe(1439);
  await expect(page.locator('[data-metric="gameTime"] strong')).toHaveText('Y1 M1 23:59');

  let after = await stepLogicalMinutes(page, 1);
  expect(after.simulation.absoluteGameMinute).toBe(1440);
  expect(after.revision - before.revision).toBe(5);
  await expect(page.locator('[data-metric="gameTime"] strong')).toHaveText('Y1 M2 00:00');
  expect(await page.locator('[data-testid="tool-context-status"]').allTextContents()).not.toContain(
    'Simulation paused: world update rejected',
  );

  before = await stepLogicalMinutes(page, 17279 - 1440);
  expect(before.simulation.absoluteGameMinute).toBe(17279);
  await expect(page.locator('[data-metric="gameTime"] strong')).toHaveText('Y1 M12 23:59');

  after = await stepLogicalMinutes(page, 1);
  expect(after.simulation.absoluteGameMinute).toBe(17280);
  expect(after.revision - before.revision).toBe(5);
  await expect(page.locator('[data-metric="gameTime"] strong')).toHaveText('Y2 M1 00:00');
  expect(await page.locator('[data-testid="tool-context-status"]').allTextContents()).not.toContain(
    'Simulation paused: world update rejected',
  );
});

test('starts at most one automatic Construction per evaluation tick', async ({ page }) => {
  await openGrowthGame(page);
  await prepareBuildingFixtureWorld(page);

  let snapshot = await stepLogicalTicks(page, 4);
  expect(snapshot.simulation.absoluteTick).toBe(12);
  expect(snapshot.simulation.growthSequence).toBe(1);
  expect(snapshot.buildingCount).toBe(1);

  snapshot = await stepLogicalTicks(page, 6);
  expect(snapshot.simulation.absoluteTick).toBe(18);
  expect(snapshot.simulation.growthSequence).toBe(2);
  expect(snapshot.buildingCount).toBe(2);
});

test('automatic Growth preserves the active Zoning tool and in-progress stroke', async ({
  page,
}) => {
  await openGrowthGame(page);
  const points = await prepareBuildingFixtureWorld(page);
  await openBuildCategory(page, 'zones');
  await page.getByRole('button', { name: 'Industrial', exact: true }).click();
  await expect(page.getByTestId('build-picker')).toBeHidden();
  await expect(page.getByTestId('nav-build')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.city-tool-context-name')).toHaveText('Industrial');
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toHaveCount(0);
  await expandToolContext(page);

  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
    const activeTool = document.querySelector<HTMLElement>('.city-tool-context-name');
    const status = document.querySelector<HTMLElement>('.city-status-feedback');
    if (canvas === null || activeTool === null || status === null) {
      throw new Error('growth:missing-isolation-probe-target');
    }
    const probe = {
      toolContextMutations: 0,
      buildingTransactions: 0,
      statusValues: [] as string[],
    };
    new MutationObserver(() => {
      probe.toolContextMutations += 1;
    }).observe(activeTool, { childList: true, characterData: true, subtree: true });
    canvas.addEventListener('web-three-city:game-tool-presentation', (event) => {
      const detail = (event as CustomEvent<{ readonly type?: string; readonly domain?: string }>)
        .detail;
      if (detail?.type === 'transaction-state' && detail.domain === 'building') {
        probe.buildingTransactions += 1;
      }
    });
    new MutationObserver(() => {
      probe.statusValues.push(status.textContent?.trim() ?? '');
    }).observe(status, { childList: true, characterData: true, subtree: true });
    (
      window as Window & {
        __WEB_THREE_CITY_GROWTH_ISOLATION_PROBE__?: typeof probe;
      }
    ).__WEB_THREE_CITY_GROWTH_ISOLATION_PROBE__ = probe;
  });

  const startPoint = pointFor(points, BUILDING_FIXTURES.industrial.zoneCells[0]);
  const endPoint = pointFor(points, BUILDING_FIXTURES.industrial.zoneCells[1]);
  const undo = page.getByTestId('tool-context-undo');
  const undoCountBeforeGrowth = await undo.count();

  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down();
  await expect
    .poll(() =>
      page.evaluate(() => window.__WEB_THREE_CITY_INTERACTION__?.zone.strokeActive ?? false),
    )
    .toBe(true);

  const snapshot = await stepLogicalTicks(page, 4);
  expect(snapshot.simulation.absoluteTick).toBeGreaterThanOrEqual(12);
  expect(snapshot.simulation.growthSequence).toBeGreaterThanOrEqual(1);
  expect(snapshot.buildingCount).toBeGreaterThanOrEqual(1);
  await expect(page.locator('.city-tool-context-name')).toHaveText('Industrial');
  await expect(page.getByTestId('nav-build')).toHaveAttribute('aria-pressed', 'false');
  await expect
    .poll(() =>
      page.evaluate(() => window.__WEB_THREE_CITY_INTERACTION__?.zone.strokeActive ?? false),
    )
    .toBe(true);
  expect(await undo.count()).toBe(undoCountBeforeGrowth);

  const probe = await page.evaluate(() => {
    const value = (
      window as Window & {
        __WEB_THREE_CITY_GROWTH_ISOLATION_PROBE__?: {
          readonly toolContextMutations: number;
          readonly buildingTransactions: number;
          readonly statusValues: readonly string[];
        };
      }
    ).__WEB_THREE_CITY_GROWTH_ISOLATION_PROBE__;
    if (value === undefined) throw new Error('growth:missing-isolation-probe');
    return value;
  });
  expect(probe.toolContextMutations).toBe(0);
  expect(probe.buildingTransactions).toBe(0);
  expect(probe.statusValues).not.toContain('Zones developed');

  await page.mouse.move(endPoint.x, endPoint.y);
  await page.mouse.up();
  await expect(page.locator('.city-tool-context-name')).toHaveText('Industrial');
});

test('persists WorldSaveV8 and loads paused at the exact logical tick', async ({ page }) => {
  await openGrowthGame(page);
  await prepareBuildingFixtureWorld(page);
  await stepLogicalTicks(page, 4);

  await clickGameMenuAction(page, 'Save world');
  const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  const parsed = JSON.parse(saved ?? '{}') as {
    readonly schemaVersion?: number;
    readonly simulation?: {
      readonly schemaVersion?: number;
      readonly absoluteGameMinute?: number;
      readonly absoluteTick?: number;
      readonly growthSequence?: number;
    };
    readonly buildings?: { readonly schemaVersion?: number };
    readonly rci?: { readonly schemaVersion?: number };
    readonly mobility?: { readonly schemaVersion?: number };
    readonly traffic?: { readonly schemaVersion?: number };
  };
  expect(parsed.schemaVersion).toBe(8);
  expect(parsed.simulation).toMatchObject({
    schemaVersion: 3,
    absoluteGameMinute: 12 * 60,
    growthSequence: 1,
  });
  expect(parsed.buildings?.schemaVersion).toBe(2);
  expect(parsed.rci?.schemaVersion).toBe(1);
  expect(parsed.mobility?.schemaVersion).toBe(2);
  expect(parsed.traffic?.schemaVersion).toBe(2);

  await stepLogicalTicks(page, 3);
  await clickGameMenuAction(page, 'Load world');
  await expect(page.getByTestId('tool-context-status')).toHaveText('Loaded');
  const loaded = await readTimeSnapshot(page);
  expect(loaded.simulation.absoluteTick).toBe(12);
  expect(loaded.simulation.growthSequence).toBe(1);
  expect(loaded.speed).toBe('paused');
  await expect(page.locator('[data-simulation-speed="paused"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('does not expose the explicit Develop Zones control in production Growth mode', async ({
  page,
}) => {
  await openGrowthGame(page);
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toHaveCount(0);
  await openBuildCategory(page, 'buildings');
  await expect(page.getByRole('button', { name: 'Bulldoze Building' })).toBeVisible();
});
