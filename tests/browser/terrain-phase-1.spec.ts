import { expect, test } from "@playwright/test";

test.use({ deviceScaleFactor: 2 });

function parseCameraTarget(
  value: string | null,
): readonly [number, number, number] {
  if (value === null)
    throw new Error("Camera target diagnostics are unavailable.");
  const parts = value.split(",").map(Number);
  if (parts.length != 3 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Invalid camera target diagnostics: ${value}`);
  }
  return [parts[0]!, parts[1]!, parts[2]!] as const;
}

test("projects production Terrain through real WebGL and semantic picking", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/terrain-phase-1.html");

  const root = page.locator("#terrain-phase-1");
  await expect(root).toHaveAttribute("data-presentation", "ready");
  await expect(root).toHaveAttribute("data-webgl", "available");
  await expect(root).toHaveAttribute("data-terrain-sectors", "64");
  await expect(root).toHaveAttribute("data-terrain-revision", "0");
  await expect(root).toHaveAttribute("data-pick-status", "hit");
  await expect(root).toHaveAttribute("data-pick-revision", "0");
  await expect(root).toHaveAttribute("data-diagnostic-lighting", "ready");
  await expect(root).toHaveAttribute("data-production-camera", "ready");
  await expect(root).toHaveAttribute("data-input-controller", "ready");
  await expect(root).toHaveAttribute("data-tap-count", "0");
  await expect(root).toHaveAttribute("data-debug-overlay", "ready");
  await page.getByTestId("debug-cellGrid").check();
  await expect(root).toHaveAttribute("data-debug-layers", "cellGrid");
  await page.getByTestId("debug-renderSectors").check();
  await expect(root).toHaveAttribute(
    "data-debug-layers",
    "cellGrid,renderSectors",
  );
  await page.getByTestId("debug-elevation").check();
  await expect(root).toHaveAttribute(
    "data-debug-layers",
    "cellGrid,renderSectors,elevation",
  );
  await page.getByTestId("debug-elevation").uncheck();

  const viewport = page.locator("#terrain-viewport");
  await expect(viewport).toHaveCSS("touch-action", "none");
  const canvas = viewport.locator("canvas.app-canvas");
  const [viewportBox, canvasBox] = await Promise.all([
    viewport.boundingBox(),
    canvas.boundingBox(),
  ]);
  expect(viewportBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  expect(canvasBox!.width).toBeCloseTo(viewportBox!.width, 0);
  expect(canvasBox!.height).toBeCloseTo(viewportBox!.height, 0);
  await expect(root).toHaveAttribute("data-pick-cell");
  await expect(root).toHaveAttribute(
    "data-pick-triangle",
    /^(SW|NE)_TRIANGLE$/,
  );

  const viewportRect = await viewport.boundingBox();
  expect(viewportRect).not.toBeNull();
  if (viewportRect === null) return;
  const centerX = viewportRect.x + viewportRect.width / 2;
  const centerY = viewportRect.y + viewportRect.height / 2;

  const beforeDownTarget = parseCameraTarget(
    await root.getAttribute("data-camera-target"),
  );
  await page.mouse.move(centerX, centerY);
  await page.mouse.down({ button: "left" });
  await page.mouse.move(centerX, centerY + 80, { steps: 4 });
  await page.mouse.up({ button: "left" });
  const afterDownTarget = parseCameraTarget(
    await root.getAttribute("data-camera-target"),
  );
  expect(afterDownTarget[0]).toBeLessThan(beforeDownTarget[0]);
  expect(afterDownTarget[2]).toBeLessThan(beforeDownTarget[2]);
  await expect(root).toHaveAttribute("data-tap-count", "0");

  const initialTarget = await root.getAttribute("data-camera-target");
  await page.mouse.move(centerX, centerY);
  await page.mouse.down({ button: "left" });
  await page.mouse.move(centerX + 100, centerY + 50, { steps: 4 });
  await page.mouse.up({ button: "left" });
  await expect(root).not.toHaveAttribute(
    "data-camera-target",
    initialTarget ?? "",
  );
  await expect(root).toHaveAttribute("data-tap-count", "0");

  const initialAzimuth = await root.getAttribute("data-camera-azimuth");
  await page.mouse.move(centerX, centerY);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(centerX + 80, centerY + 20, { steps: 4 });
  await page.mouse.up({ button: "right" });
  await expect(root).not.toHaveAttribute(
    "data-camera-azimuth",
    initialAzimuth ?? "",
  );

  const initialDistance = await root.getAttribute("data-camera-distance");
  await page.mouse.move(centerX, centerY);
  await page.mouse.wheel(0, 220);
  await expect(root).not.toHaveAttribute(
    "data-camera-distance",
    initialDistance ?? "",
  );

  await page.mouse.click(centerX, centerY);
  await expect(root).toHaveAttribute("data-tap-count", "1");
  await expect(root).toHaveAttribute("data-pick-status", "hit");

  await page.getByTestId("terrain-rebuild").click();
  await expect(root).toHaveAttribute("data-terrain-revision", "1");
  await expect(root).toHaveAttribute("data-presentation-revision", "1");

  expect(errors).toEqual([]);

  await page.goto("about:blank");
  expect(errors).toEqual([]);
});

test("routes mobile touch gestures to camera without accidental terrain taps", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/terrain-phase-1.html");
  const root = page.locator("#terrain-phase-1");
  await expect(root).toHaveAttribute("data-production-camera", "ready");
  const viewport = page.locator("#terrain-viewport");
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) return;
  const cdp = await context.newCDPSession(page);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  const beforeTouchDownTarget = parseCameraTarget(
    await root.getAttribute("data-camera-target"),
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: cx, y: cy, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: cx, y: cy + 80, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const afterTouchDownTarget = parseCameraTarget(
    await root.getAttribute("data-camera-target"),
  );
  expect(afterTouchDownTarget[0]).toBeLessThan(beforeTouchDownTarget[0]);
  expect(afterTouchDownTarget[2]).toBeLessThan(beforeTouchDownTarget[2]);
  await expect(root).toHaveAttribute("data-tap-count", "0");

  const initialTarget = await root.getAttribute("data-camera-target");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: cx, y: cy, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: cx + 90, y: cy + 40, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(root).not.toHaveAttribute(
    "data-camera-target",
    initialTarget ?? "",
  );
  await expect(root).toHaveAttribute("data-tap-count", "0");

  const beforeCentroidTarget = parseCameraTarget(
    await root.getAttribute("data-camera-target"),
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: cx - 50, y: cy, id: 1 },
      { x: cx + 50, y: cy, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: cx - 50, y: cy + 60, id: 1 },
      { x: cx + 50, y: cy + 60, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const afterCentroidTarget = parseCameraTarget(
    await root.getAttribute("data-camera-target"),
  );
  expect(afterCentroidTarget[0]).toBeLessThan(beforeCentroidTarget[0]);
  expect(afterCentroidTarget[2]).toBeLessThan(beforeCentroidTarget[2]);
  await expect(root).toHaveAttribute("data-tap-count", "0");

  const beforeDistance = await root.getAttribute("data-camera-distance");
  const beforeAzimuth = await root.getAttribute("data-camera-azimuth");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: cx - 50, y: cy, id: 1 },
      { x: cx + 50, y: cy, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: cx - 80, y: cy - 20, id: 1 },
      { x: cx + 80, y: cy + 20, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(root).not.toHaveAttribute(
    "data-camera-distance",
    beforeDistance ?? "",
  );
  await expect(root).not.toHaveAttribute(
    "data-camera-azimuth",
    beforeAzimuth ?? "",
  );
  await expect(root).toHaveAttribute("data-tap-count", "0");

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: cx, y: cy, id: 3 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(root).toHaveAttribute("data-tap-count", "1");
  await expect(root).toHaveAttribute("data-pick-status", "hit");
  expect(errors).toEqual([]);
});
