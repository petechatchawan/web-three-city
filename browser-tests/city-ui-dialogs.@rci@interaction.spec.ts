import { expect, test } from '@playwright/test';
import { openBuildCategory, waitForCityUi } from './helpers/city-ui.js';
import { GAME_URL } from './helpers/interaction.js';

async function readAbsoluteTick(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const timeWindow = window as Window & {
      __WEB_THREE_CITY_TIME__?: { snapshot(): { simulation: { absoluteTick: number } } };
    };
    const tick = timeWindow.__WEB_THREE_CITY_TIME__?.snapshot().simulation.absoluteTick;
    if (tick === undefined) throw new Error('city-ui-dialogs:missing-time-api');
    return tick;
  });
}

test('City Economy dialog refreshes and applies tax without changing the active tool', async ({
  page,
}) => {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto(GAME_URL);
  await waitForCityUi(page);
  await openBuildCategory(page, 'roads');
  await page.getByRole('button', { name: 'Build Road', exact: true }).click();
  await expect(page.getByTestId('build-picker')).toBeHidden();
  await expect(page.locator('.city-tool-context-name')).toHaveText('Build Road');
  const beforeTick = await readAbsoluteTick(page);

  await page.getByRole('button', { name: 'City', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('City Overview');
  await dialog.getByRole('button', { name: 'Economy', exact: true }).click();
  await expect(dialog).toContainText('Road maintenance');

  await page.evaluate(() => {
    const timeWindow = window as Window & {
      __WEB_THREE_CITY_TIME__?: { step(): boolean };
    };
    if (timeWindow.__WEB_THREE_CITY_TIME__?.step() !== true) {
      throw new Error('city-ui-dialogs:step-rejected');
    }
  });
  await expect.poll(() => readAbsoluteTick(page)).toBe(beforeTick + 1);

  await dialog.getByRole('button', { name: 'Taxation', exact: true }).click();
  await dialog.getByTestId('tax-residential').selectOption('8');
  await dialog.getByTestId('apply-tax-policy').click();
  await expect(dialog.getByRole('status')).toHaveText('Tax policy updated');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.city-tool-context-name')).toHaveText('Build Road');
  await expect(page.getByTestId('nav-build')).toHaveAttribute('aria-pressed', 'false');
});
