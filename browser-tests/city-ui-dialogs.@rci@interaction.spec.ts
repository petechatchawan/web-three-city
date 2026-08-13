import { expect, test } from '@playwright/test';
import { GAME_URL } from './helpers/interaction.js';

test('City Economy dialog refreshes and applies tax without changing the active tool', async ({
  page,
}) => {
  await page.goto(GAME_URL);
  await expect(page.getByTestId('tool-context-status')).toHaveText('Ready');
  await page.getByRole('button', { name: 'Roads', exact: true }).click();
  await page.getByRole('button', { name: 'Build Road', exact: true }).last().click();
  const beforeTick = await page.evaluate(() => {
    const timeWindow = window as Window & {
      __WEB_THREE_CITY_TIME__?: { snapshot(): { simulation: { absoluteTick: number } } };
    };
    return timeWindow.__WEB_THREE_CITY_TIME__?.snapshot().simulation.absoluteTick;
  });
  await page.getByRole('button', { name: 'City', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('City Overview');
  await dialog.getByRole('button', { name: 'Economy', exact: true }).click();
  await expect(dialog).toContainText('Road maintenance');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const timeWindow = window as Window & {
          __WEB_THREE_CITY_TIME__?: { snapshot(): { simulation: { absoluteTick: number } } };
        };
        return timeWindow.__WEB_THREE_CITY_TIME__?.snapshot().simulation.absoluteTick;
      }),
    )
    .not.toBe(beforeTick);
  await dialog.getByRole('button', { name: 'Taxation', exact: true }).click();
  await dialog.getByTestId('tax-residential').selectOption('8');
  await dialog.getByTestId('apply-tax-policy').click();
  await expect(dialog.getByRole('status')).toHaveText('Tax policy updated');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByTestId('tool-context-name')).toHaveText('Build Road');
});
