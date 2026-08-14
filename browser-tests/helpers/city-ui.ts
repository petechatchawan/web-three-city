import { expect, type Page } from '@playwright/test';

export type BuildCategory = 'terrain' | 'roads' | 'zones' | 'buildings';

export async function waitForCityUi(page: Page): Promise<void> {
  await expect(page.getByTestId('nav-terrain')).toBeVisible();
  await expect(page.getByTestId('nav-city')).toBeVisible();
  await expect(page.locator('.city-awareness-hud')).toBeVisible();
}

export async function openBuildCategory(page: Page, category: BuildCategory): Promise<void> {
  const nav = page.getByTestId(`nav-${category}`);
  if ((await nav.getAttribute('aria-pressed')) !== 'true') await nav.click();
  await expect(nav).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('subtool-tray')).toBeVisible();
}

export async function closeBuild(page: Page): Promise<void> {
  const active = page.locator(
    '.city-bottom-nav [data-nav-category]:not([data-nav-category="city"])[aria-pressed="true"]',
  );
  if ((await active.count()) > 0) await active.first().click();
  await expect(page.getByTestId('subtool-tray')).toBeHidden();
  await expect(
    page.locator(
      '.city-bottom-nav [data-nav-category]:not([data-nav-category="city"])[aria-pressed="true"]',
    ),
  ).toHaveCount(0);
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
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Game Menu', exact: true })
    .click();
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
