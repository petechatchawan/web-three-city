import { expect, test } from "@playwright/test";

test("home screen cleanly separates empty and resumable states", async ({
  page,
}) => {
  await page.goto("/city-screens-test.html?screen=home-empty");
  const root = page.locator("#city-screens-test");
  await expect(root).toHaveAttribute("data-ready", "true");
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Web Three City" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "New City" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load City" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Resume/i })).toHaveCount(0);
  await expect(page.getByText("No saved cities yet")).toBeVisible();

  await page.goto("/city-screens-test.html?screen=home-populated");
  await expect(
    page.getByRole("heading", { name: "Metro Alpha", exact: true }),
  ).toBeVisible();
  const resume = page.getByRole("button", { name: /Resume Metro Alpha/i });
  await expect(resume).toBeVisible();
  await expect(
    page.getByText("Last played 30 Aug 2026, 04:00 UTC", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const handle = (
      window as typeof window & {
        screenHandle?: {
          setBusy(value: boolean): void;
          setError(value?: string): void;
        };
      }
    ).screenHandle;
    if (handle === undefined) throw new Error("screen handle unavailable");
    handle.setBusy(true);
    handle.setError("Resume temporarily unavailable");
  });
  await expect(resume).toBeDisabled();
  await expect(
    page.getByText("Resume temporarily unavailable", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const handle = (
      window as typeof window & {
        screenHandle?: {
          setBusy(value: boolean): void;
          setError(value?: string): void;
        };
      }
    ).screenHandle;
    if (handle === undefined) throw new Error("screen handle unavailable");
    handle.setBusy(false);
    handle.setError(undefined);
  });
  await expect(resume).toBeEnabled();
  await resume.click();
  await expect(page.locator("#city-screens-test")).toHaveAttribute(
    "data-calls",
    "resume:city-a",
  );
});

test("new city screen randomizes, generates, previews and selects an eligible Region", async ({
  page,
}) => {
  await page.goto("/city-screens-test.html?screen=new");
  const root = page.locator("#city-screens-test");
  await expect(root).toHaveAttribute("data-ready", "true");
  const name = page.getByLabel("City name");
  const seed = page.getByLabel("Terrain seed");
  await expect(name).toBeVisible();
  await expect(seed).toHaveValue("0xAAAAAAAAAAAAAAAA");

  await page.getByRole("button", { name: "Generate terrain" }).click();
  await expect(page.getByText("City name is required")).toBeVisible();
  await expect(root).not.toHaveAttribute("data-calls", /generate:/);

  await page.getByRole("button", { name: "Randomize seed" }).click();
  await expect(seed).toHaveValue("0x0123456789ABCDEF");
  await name.fill("Harbor City");
  await page.getByRole("button", { name: "Generate terrain" }).click();
  await expect(root).toHaveAttribute(
    "data-calls",
    "generate:Harbor City:0x0123456789ABCDEF",
  );
  await expect(page.getByText("0xF2FA29BFD2AEB069")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create city" }),
  ).toBeDisabled();

  await page.getByRole("radio", { name: "R08" }).check();
  await expect(page.getByRole("button", { name: "Create city" })).toBeEnabled();
  await page.getByRole("button", { name: "Create city" }).click();
  await expect(root).toHaveAttribute(
    "data-calls",
    "generate:Harbor City:0x0123456789ABCDEF,create:R08",
  );
});

test("load screen selects a save before one explicit Load City action", async ({
  page,
}) => {
  await page.goto("/city-screens-test.html?screen=load-empty");
  await expect(page.getByText("No saved cities")).toBeVisible();

  await page.goto("/city-screens-test.html?screen=load-populated");
  const root = page.locator("#city-screens-test");
  await expect(
    page.getByRole("button", { name: "Select Metro Alpha" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select Metro Beta" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Load City", exact: true }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Select Metro Beta" }).click();
  await expect(root).toHaveAttribute("data-calls", "select:city-b");
  await expect(
    page
      .getByTestId("load-city-detail")
      .getByRole("heading", { name: "Metro Beta", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Seed 0x1234567890ABCDEF", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Terrain revision 3", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Starting Region R06", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("load-city-detail")
      .getByText("Last played 30 Aug 2026, 03:00 UTC", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Load City", exact: true }).click();
  await expect(root).toHaveAttribute("data-calls", "select:city-b,load:city-b");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("load-city-detail")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test("all city lifecycle screens remain within compact and landscape viewport profiles", async ({
  page,
}) => {
  for (const viewport of [
    { name: "portrait", width: 390, height: 844 },
    { name: "landscape", width: 844, height: 390 },
    { name: "minimum", width: 320, height: 568 },
  ] as const) {
    await page.setViewportSize(viewport);
    for (const screen of [
      "home-empty",
      "home-populated",
      "new",
      "load-empty",
      "load-populated",
    ]) {
      await page.goto(`/city-screens-test.html?screen=${screen}`);
      await expect(page.locator("#city-screens-test")).toHaveAttribute(
        "data-ready",
        "true",
      );
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(
        hasOverflow,
        `horizontal overflow on ${screen} at ${viewport.name}`,
      ).toBe(false);
    }
  }
});
