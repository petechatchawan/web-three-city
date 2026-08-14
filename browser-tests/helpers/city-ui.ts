import { expect, type Page } from '@playwright/test';

export type BuildCategory = 'terrain' | 'roads' | 'zones' | 'buildings';

export async function waitForCityUi(page: Page): Promise<void> {
  await expect(page.getByTestId('nav-build')).toBeVisible();
  await expect(page.getByTestId('nav-city')).toBeVisible();
  for (const retired of ['nav-terrain', 'nav-roads', 'nav-zones', 'nav-buildings']) {
    await expect(page.getByTestId(retired)).toHaveCount(0);
  }
  await expect(page.locator('.city-awareness-hud')).toBeVisible();
}

export async function openBuildCategory(page: Page, category: BuildCategory): Promise<void> {
  const build = page.getByTestId('nav-build');
  const picker = page.getByTestId('build-picker');
  if (!(await picker.isVisible())) await build.click();
  await expect(build).toHaveAttribute('aria-pressed', 'true');
  await expect(picker).toBeVisible();
  if ((await picker.getAttribute('data-category')) !== category) {
    await page.getByTestId(`build-category-${category}`).click();
  }
  await expect(picker).toHaveAttribute('data-category', category);
}

export async function closeBuild(page: Page): Promise<void> {
  const build = page.getByTestId('nav-build');
  const picker = page.getByTestId('build-picker');
  if (await picker.isVisible()) await build.click();
  await expect(picker).toBeHidden();
  await expect(build).toHaveAttribute('aria-pressed', 'false');
}

export async function openCityManagement(page: Page): Promise<void> {
  const activeDialog = page.getByRole('dialog');
  if (await activeDialog.isVisible()) {
    await activeDialog.getByRole('button', { name: 'Close', exact: true }).click();
  }
  await page.getByTestId('nav-city').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('City Overview');
}

export async function openGameMenu(page: Page): Promise<void> {
  await openCityManagement(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Game Menu', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('World');
}

export async function openInformationViews(page: Page): Promise<void> {
  await openCityManagement(page);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Information Views', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Canonical Grid');
}

export async function expandToolContext(page: Page): Promise<void> {
  const toggle = page.getByTestId('tool-context-toggle');
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

export async function clickToolUndo(page: Page): Promise<void> {
  await expandToolContext(page);
  await page.getByTestId('tool-context-undo').click();
}
