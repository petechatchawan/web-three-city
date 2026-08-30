import { expect, test } from "@playwright/test";

const GOLDEN_SEED = "0x5EED5EED5EED5EED";
const GOLDEN_FINGERPRINT = "0xF2FA29BFD2AEB069";

test("runs new save load and resume through the production city lifecycle", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");

  const app = page.locator("#app");
  await expect(app).toHaveAttribute("data-screen", "home");

  await page.getByRole("button", { name: "New City" }).click();
  await expect(app).toHaveAttribute("data-screen", "new-city");
  await page.getByLabel("City name").fill("Production City");
  await page.getByLabel("Terrain seed").fill(GOLDEN_SEED);
  await page.getByRole("button", { name: "Generate terrain" }).click();
  await expect(
    page.getByText(GOLDEN_FINGERPRINT, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "R08" })).toBeVisible();
  await page.getByRole("radio", { name: "R08" }).check();
  await page.getByRole("button", { name: "Create city" }).click();

  await expect(app).toHaveAttribute("data-screen", "live-city");
  await expect(app).toHaveAttribute("data-live-runtime", "ready");
  const game = page.getByTestId("game-screen");
  await expect(game).toHaveAttribute("data-terrain-sectors", "64");
  await expect(game).toHaveAttribute("data-pick-status", "hit");
  await expect(page.getByText(GOLDEN_SEED, { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Save city" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Exit city" }).click();

  await expect(app).toHaveAttribute("data-screen", "home");
  await expect(
    page.getByRole("button", { name: "Resume Production City" }),
  ).toBeVisible();
  await expect(page.getByText(GOLDEN_SEED, { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Load City" }).click();
  await expect(app).toHaveAttribute("data-screen", "load-city");
  await expect(
    page.getByRole("heading", { name: "Production City", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load Production City" }).click();
  await expect(app).toHaveAttribute("data-screen", "live-city");
  await expect(app).toHaveAttribute("data-live-runtime", "ready");
  await page.getByRole("button", { name: "Exit city" }).click();

  await expect(app).toHaveAttribute("data-screen", "home");
  await page.getByRole("button", { name: "Resume Production City" }).click();
  await expect(app).toHaveAttribute("data-screen", "live-city");
  await expect(app).toHaveAttribute("data-live-runtime", "ready");
  await expect(game).toHaveAttribute("data-terrain-sectors", "64");

  expect(errors).toEqual([]);
});

test("repeats the same seed fingerprint and resumes the most recently played city", async ({
  page,
}) => {
  await page.goto("/");
  const app = page.locator("#app");
  await expect(app).toHaveAttribute("data-screen", "home");

  async function createNamedCity(name: string): Promise<string> {
    await page.getByRole("button", { name: "New City" }).click();
    await page.getByLabel("City name").fill(name);
    await page.getByLabel("Terrain seed").fill(GOLDEN_SEED);
    await page.getByRole("button", { name: "Generate terrain" }).click();
    const fingerprint = page
      .getByText(/^0x[0-9A-F]{16}$/)
      .filter({ hasText: GOLDEN_FINGERPRINT });
    await expect(fingerprint).toBeVisible();
    const value = (await fingerprint.textContent()) ?? "";
    await page.getByRole("radio", { name: "R08" }).check();
    await page.getByRole("button", { name: "Create city" }).click();
    await expect(app).toHaveAttribute("data-screen", "live-city");
    await expect(app).toHaveAttribute("data-live-runtime", "ready");
    return value;
  }

  const firstFingerprint = await createNamedCity("Repeat A");
  await page.getByRole("button", { name: "Exit city" }).click();
  await expect(app).toHaveAttribute("data-screen", "home");

  const secondFingerprint = await createNamedCity("Repeat B");
  expect(secondFingerprint).toBe(firstFingerprint);
  await page.getByRole("button", { name: "Exit city" }).click();
  await expect(app).toHaveAttribute("data-screen", "home");

  await expect(
    page.getByRole("button", { name: "Resume Repeat B" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume Repeat B" }).click();
  await expect(app).toHaveAttribute("data-screen", "live-city");
  await expect(
    page.getByRole("heading", { name: "Repeat B", exact: true }),
  ).toBeVisible();
});
