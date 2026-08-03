import { expect, test } from '@playwright/test';
import { GAME_URL, readEvidence } from './helpers/interaction.js';

test('exposes Building Foundation controls and authoritative evidence', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  await expect(page.getByRole('button', { name: 'Develop Zones' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bulldoze Building' })).toBeVisible();
  await expect(page.getByTestId('building-count')).toHaveText('0');
  const evidence = await readEvidence(page);
  expect(evidence.building.committedBuildingRevision).toBe(0);
  expect(evidence.building.count).toBe(0);
  expect(evidence.sceneRootCounts.buildingCommitted).toBe(1);
});

test('Develop Zones fails closed before eligible Zones exist', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await page.getByRole('button', { name: 'Develop Zones' }).click();
  await page.locator('#game-canvas').click({ position: { x: 700, y: 450 } });
  await expect(page.getByTestId('game-status')).toHaveText('No eligible Zoned lots');
});
