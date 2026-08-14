import { expect, test } from '@playwright/test';
import {
  BUILDING_FIXTURES,
  pointFor,
  prepareBuildingFixtureWorld,
} from './helpers/building-fixture.js';
import { openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import {
  prepareDeterministicGrowthClock,
  readTimeSnapshot,
  stepLogicalTicks,
} from './helpers/growth-fixture.js';
import { GAME_URL, clickGameMenuAction } from './helpers/interaction.js';

test.describe.configure({ timeout: 60_000 });

const SAVE_KEY = 'web-three-city:world-save:v6';

async function openGrowthGame(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
  await prepareDeterministicGrowthClock(page);
}

test('exposes the simple calendar and deterministic time controls', async ({ page }) => {
  await openGrowthGame(page);
  await expect(page.locator('[data-metric="gameTime"] strong')).toHaveText('Y1 M1 D1 08:00');
  const speed = page.locator('[data-simulation-speed]');
  await expect(speed).toHaveText('Ⅱ');
  await expect(page.locator('[data-simulation-step]')).toBeEnabled();

  await speed.click();
  await expect(speed).toHaveText('1×');
  await expect(page.locator('[data-simulation-step]')).toHaveCount(0);
  await speed.click();
  await expect(speed).toHaveText('2×');
  await speed.click();
  await expect(speed).toHaveText('4×');
  await speed.click();
  await expect(speed).toHaveText('Ⅱ');
  await expect(page.locator('[data-simulation-step]')).toBeEnabled();

  // Cycling through running speeds can legitimately advance wall-clock driven ticks.
  // Reset the deterministic test clock before asserting Step semantics so the test
  // verifies the command itself rather than scheduler timing under CI load.
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
  const industrialButton = page.getByRole('button', { name: 'Industrial', exact: true });
  await industrialButton.click();
  await expect(industrialButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toHaveCount(0);

  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
    const navigate = document.querySelector<HTMLButtonElement>('[data-testid="primary-navigate"]');
    const status = document.querySelector<HTMLElement>('.city-status-feedback');
    if (canvas === null || navigate === null || status === null) {
      throw new Error('growth:missing-isolation-probe-target');
    }
    const probe = {
      navigateClicks: 0,
      buildingTransactions: 0,
      statusValues: [] as string[],
    };
    navigate.addEventListener('click', () => {
      probe.navigateClicks += 1;
    });
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

  const snapshot = await readTimeSnapshot(page);
  expect(snapshot.simulation.absoluteTick).toBeGreaterThanOrEqual(12);
  expect(snapshot.simulation.growthSequence).toBeGreaterThanOrEqual(1);
  expect(snapshot.buildingCount).toBeGreaterThanOrEqual(1);
  await expect(industrialButton).toHaveAttribute('aria-pressed', 'true');
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
          readonly navigateClicks: number;
          readonly buildingTransactions: number;
          readonly statusValues: readonly string[];
        };
      }
    ).__WEB_THREE_CITY_GROWTH_ISOLATION_PROBE__;
    if (value === undefined) throw new Error('growth:missing-isolation-probe');
    return value;
  });
  expect(probe.navigateClicks).toBe(0);
  expect(probe.buildingTransactions).toBe(0);
  expect(probe.statusValues).not.toContain('Zones developed');

  await page.mouse.move(endPoint.x, endPoint.y);
  await page.mouse.up();
  await expect(industrialButton).toHaveAttribute('aria-pressed', 'true');
});

test('persists WorldSaveV6 and loads paused at the exact logical tick', async ({ page }) => {
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
  };
  expect(parsed.schemaVersion).toBe(6);
  expect(parsed.simulation).toMatchObject({ absoluteTick: 12, growthSequence: 1 });
  expect(parsed.buildings?.schemaVersion).toBe(2);
  expect(parsed.rci?.schemaVersion).toBe(1);

  await stepLogicalTicks(page, 3);
  await clickGameMenuAction(page, 'Load world');
  await expect(page.getByTestId('tool-context-status')).toHaveText('Loaded');
  const loaded = await readTimeSnapshot(page);
  expect(loaded.simulation.absoluteTick).toBe(12);
  expect(loaded.simulation.growthSequence).toBe(1);
  expect(loaded.speed).toBe('paused');
});

test('does not expose the explicit Develop Zones control in production Growth mode', async ({
  page,
}) => {
  await openGrowthGame(page);
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toHaveCount(0);
  await openBuildCategory(page, 'buildings');
  await expect(page.getByRole('button', { name: 'Bulldoze Building' })).toBeVisible();
});
