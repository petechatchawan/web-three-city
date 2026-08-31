import { expect, test, type Page } from "@playwright/test";

async function validTerraformPoint(page: Page) {
  const box = await page.getByTestId("game-viewport").boundingBox();
  if (box === null) throw new Error("Game viewport has no bounding box.");
  const game = page.getByTestId("game-screen");
  for (let row = 2; row <= 8; row += 1) {
    for (let column = 1; column <= 9; column += 1) {
      const point = {
        x: box.x + (box.width * column) / 10,
        y: box.y + (box.height * row) / 12,
      };
      await page.mouse.move(point.x, point.y);
      if ((await game.getAttribute("data-terraform-preview")) === "valid") {
        return point;
      }
    }
  }
  throw new Error("No visible valid Terraform target was found.");
}

test("single-touch tap commits once and two-touch takeover cancels Terraform commit", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/live-city-test.html");
    const mount = page.locator("#live-city-test");
    const game = page.getByTestId("game-screen");
    await expect(mount).toHaveAttribute("data-live-runtime", "ready");
    await page.getByRole("button", { name: "Terraform", exact: true }).click();
    const point = await validTerraformPoint(page);

    const beforeTap = Number(await game.getAttribute("data-terrain-revision"));
    await page.touchscreen.tap(point.x, point.y);
    await expect(game).toHaveAttribute(
      "data-terrain-revision",
      String(beforeTap + 1),
    );

    const beforeTakeover = Number(
      await game.getAttribute("data-terrain-revision"),
    );
    const beforeTarget = await game.getAttribute("data-camera-target");
    const client = await context.newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point.x, y: point.y, id: 1 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: point.x, y: point.y, id: 1 },
        { x: point.x + 60, y: point.y, id: 2 },
      ],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: point.x + 15, y: point.y + 20, id: 1 },
        { x: point.x + 80, y: point.y + 25, id: 2 },
      ],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });

    await expect(game).toHaveAttribute(
      "data-terrain-revision",
      String(beforeTakeover),
    );
    await expect
      .poll(() => game.getAttribute("data-camera-target"))
      .not.toBe(beforeTarget);
  } finally {
    await context.close();
  }
});
