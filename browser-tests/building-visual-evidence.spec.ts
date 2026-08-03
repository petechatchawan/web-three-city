import { expect, test } from '@playwright/test';
import { GAME_URL } from './helpers/interaction.js';

test('captures the Building Foundation empty-world baseline', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  await page.screenshot({ path: testInfo.outputPath('building-foundation-baseline.png'), fullPage: true });
});
