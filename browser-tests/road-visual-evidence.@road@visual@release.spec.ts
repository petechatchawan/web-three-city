import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import { GAME_URL, TERRAIN_LAB_URL } from './helpers/interaction.js';

async function captureFixture(
  page: Page,
  testInfo: TestInfo,
  fixture: string,
  fileName: string,
): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${TERRAIN_LAB_URL}?fixture=${fixture}`);
  await expect(page.getByTestId('terrain-status')).toHaveText('Ready');
  await page.screenshot({ path: testInfo.outputPath(fileName), fullPage: true });
}

test('captures Road topology overview', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'road-four-way', 'road-topology-four-way.png');
});

test('captures both-axis Ramp alignment', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'road-ramp-north-up', 'road-ramp-north-south.png');
  await captureFixture(page, testInfo, 'road-ramp-east-up', 'road-ramp-east-west.png');
});

test('captures invalid Preview feedback', async ({ page }, testInfo) => {
  await captureFixture(
    page,
    testInfo,
    'road-invalid-ramp-perpendicular',
    'road-invalid-ramp-preview.png',
  );
  await captureFixture(page, testInfo, 'road-invalid-wet', 'road-invalid-wet-preview.png');
});

test('captures cross-chunk Road continuity', async ({ page }, testInfo) => {
  await captureFixture(page, testInfo, 'road-chunk-boundary', 'road-chunk-boundary.png');
});

test('captures the canonical mobile Game Road Build context', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Build Road' }).click();
  await expect(page.getByTestId('build-picker')).toBeHidden();
  await expect(page.locator('.city-tool-context-name')).toHaveText('Build Road');
  await expect(page.getByTestId('nav-build')).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: testInfo.outputPath('road-game-mobile.png'), fullPage: true });
});
