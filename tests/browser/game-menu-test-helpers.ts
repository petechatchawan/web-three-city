import type { Page } from "@playwright/test";

export type GameMenuAction = "Resume" | "Save City" | "Debug" | "Exit City";

export async function gameMenuAction(
  page: Page,
  action: GameMenuAction,
): Promise<void> {
  const menu = page.getByRole("dialog", { name: "Game menu" });
  if (!(await menu.isVisible())) {
    await page.getByRole("button", { name: "Open game menu" }).click();
  }
  await menu.getByRole("button", { name: action }).click();
}
