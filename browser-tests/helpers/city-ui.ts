import { expect, type Page } from '@playwright/test';

export type BuildCategory = 'terrain' | 'roads' | 'zones' | 'buildings';

export async function waitForCityUi(page: Page): Promise<void> {
  await expect(page.getByTestId('build-cta')).toBeVisible();
  await expect(page.locator('.city-awareness-hud')).toBeVisible();
}

export async function openBuild(page: Page): Promise<void> {
  const build = page.getByTestId('build-cta');
  if ((await build.getAttribute('aria-expanded')) !== 'true') await build.click();
  await expect(page.getByTestId('build-category-dock')).toBeVisible();
}

export async function openBuildCategory(page: Page, category: BuildCategory): Promise<void> {
  await openBuild(page);
  await page.getByTestId(`build-category-${category}`).click();
  await expect(page.getByTestId('subtool-tray')).toBeVisible();
  await expect(
    page.locator(`[data-build-category="${category}"][aria-pressed="true"]`),
  ).toBeVisible();
}

export async function closeBuild(page: Page): Promise<void> {
  const dock = page.getByTestId('build-category-dock');
  if (await dock.isVisible()) await page.getByTestId('build-close').click();
  await expect(dock).toBeHidden();
  await expect(page.getByTestId('subtool-tray')).toBeHidden();
  await expect(page.getByTestId('build-cta')).toHaveAttribute('aria-expanded', 'false');
}
