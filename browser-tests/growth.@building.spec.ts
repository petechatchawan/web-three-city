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
  stepLogicalTicks,
} from './helpers/growth-fixture.js';
import { GAME_URL, clickGameMenuAction } from './helpers/interaction.js';

test.describe.configure({ timeout: 60_000 });

const SAVE_KEY = 'web-three-city:world-save:v7';

async function openGrowthGame(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
  await prepareDeterministicGrowthClock(page);
}

test('exposes the simple calendar and deterministic time controls', async ({ page }) => {
  await openGrowthGame(page);
  await expect(page.locator('[data-metric="gameTime"] strong')).toHaveText('Y1 M1 D1 08:00');
  const paused = page.locator('[data-simulation-speed="paused"]');
  const normal = page.locator('[data-simulation-speed="normal"]');
  const fast = page.locator('[data-simulation-speed="fast"]');
  const faster = page.locator('[data-simulation-speed="faster"]');
  await expect(paused).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-simulation-step]')).toBeEnabled();

  await normal.click();
  await expect(normal).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-simulation-step]')).toHaveCount(0);
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
  await expect(page.locator('[data-metric="gameTime"] strong')).toHaveText('Y1 M1 D1 09:00');
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

  await page.evaluate(() => {
    const timeWindow = window as Window & {
      __WEB_THREE_CITY_TIME__?: {
        setSpeed(speed: 'paused' | 'normal' | 'fast' | 'faster'): void;
      };
    };
    timeWindow.__WEB_THREE_CITY_TIME__?.setSpeed('faster');
  });
  await expect(page.locator('[data-simulation-speed="faster"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect
    .poll(async () => (await readTimeSnapshot(page)).simulation.absoluteTick, {
      timeout: 5_000,
    })
    .toBeGreaterThanOrEqual(12);
  await page.evaluate(() => {
    const timeWindow = window as Window & {
      __WEB_THREE_CITY_TIME__?: {
        setSpeed(speed: 'paused' | 'normal' | 'fast' | 'faster'): void;
      };
    };
    timeWindow.__WEB_THREE_CITY_TIME__?.setSpeed('paused');
  });
  await expect(page.locator('[data-simulation-speed="paused"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const snapshot = await readTimeSnapshot(page);
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

test('persists WorldSaveV7 and loads paused at the exact logical tick', async ({ page }) => {
  await openGrowthGame(page);
  await prepareBuildingFixtureWorld(page);
  await stepLogicalTicks(page, 4);

  await clickGameMenuAction(page, 'Save world');
  const saved = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  const parsed = JSON.parse(saved ?? '{}') as {
    readonly schemaVersion?: number;
    readonly simulation?: { readonly absoluteTick?: number; readonly growthSequence?: number };
    readonly buildings?: { readonly schemaVersion?: number };
    readonly rci?: { readonly schemaVersion?: number };
    readonly mobility?: { readonly schemaVersion?: number };
    readonly traffic?: { readonly schemaVersion?: number };
  };
  expect(parsed.schemaVersion).toBe(7);
  expect(parsed.simulation).toMatchObject({ absoluteTick: 12, growthSequence: 1 });
  expect(parsed.buildings?.schemaVersion).toBe(2);
  expect(parsed.rci?.schemaVersion).toBe(1);
  expect(parsed.mobility?.schemaVersion).toBe(1);
  expect(parsed.traffic?.schemaVersion).toBe(1);

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
