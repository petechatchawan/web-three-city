import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const OUTPUT_DIRECTORY = 'test-results/screenshots';

const SCREENSHOTS = [
  ['coastal-overview.png', '?fixture=coastal'],
  ['shape-atlas-overview.png', '?fixture=shape-atlas'],
  ['ramp-north.png', '?fixture=shape-atlas&shape=ramp-north'],
  ['ramp-south.png', '?fixture=shape-atlas&shape=ramp-south'],
  ['ramp-east.png', '?fixture=shape-atlas&shape=ramp-east'],
  ['ramp-west.png', '?fixture=shape-atlas&shape=ramp-west'],
  ['single-corner-high.png', '?fixture=shape-atlas&shape=single-corner-high'],
  ['single-corner-low.png', '?fixture=shape-atlas&shape=single-corner-low'],
  ['raised-plateau.png', '?fixture=shape-atlas&shape=raised-plateau'],
  ['basin.png', '?fixture=shape-atlas&shape=basin'],
  ['staircase.png', '?fixture=shape-atlas&shape=staircase'],
  ['diagonal-ridge.png', '?fixture=shape-atlas&shape=diagonal-ridge'],
  ['diagonal-valley.png', '?fixture=shape-atlas&shape=diagonal-valley'],
  ['saddle-twist.png', '?fixture=shape-atlas&shape=saddle-twist'],
  ['chunk-seam-closeup.png', '?fixture=chunk-seam'],
  ['outer-boundary-skirt.png', '?fixture=boundary-skirt'],
] as const;

test('captures exact-head visual and performance evidence', async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const [filename, query] of SCREENSHOTS) {
    await page.goto(`http://127.0.0.1:4173/${query}`);
    await expect(page.getByTestId('terrain-status')).toHaveText('Ready');
    await page.screenshot({ path: `${OUTPUT_DIRECTORY}/${filename}`, fullPage: true });
  }

  await page.goto('http://127.0.0.1:4173/?fixture=picking');
  await expect(page.getByTestId('terrain-status')).toHaveText('Ready');
  for (const degrees of [0, 90, 180, 270]) {
    if (degrees > 0) await page.getByRole('button', { name: 'Rotate right' }).click();
    await page.screenshot({
      path: `${OUTPUT_DIRECTORY}/picking-rotation-${degrees}.png`,
      fullPage: true,
    });
  }
  await page.screenshot({
    path: `${OUTPUT_DIRECTORY}/picking-four-rotations.png`,
    fullPage: true,
  });

  await page.goto('http://127.0.0.1:4173/?fixture=coastal');
  await expect(page.getByTestId('terrain-status')).toHaveText('Ready');
  const evidence = await page.evaluate(() => window.__WEB_THREE_CITY_EVIDENCE__);
  expect(evidence).toBeDefined();
  await writeFile(
    'test-results/terrain-performance-evidence.json',
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );
});
