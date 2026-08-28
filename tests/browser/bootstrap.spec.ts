import { expect, test } from '@playwright/test';

test('boots the clean-slate game shell without gameplay systems', async ({ page }) => {
  await page.goto('/');

  const shell = page.getByTestId('game-shell');
  await expect(shell).toHaveAttribute('data-bootstrap-state', 'ready');

  const canvas = page.getByTestId('three-bootstrap-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-three-bootstrap', 'ready');
});
