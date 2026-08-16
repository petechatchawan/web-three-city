import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const approvedDomainTag = /@(terrain|water|road|zoning|building|rci|traffic|interaction)/;
const approvedTag =
  /@(smoke|terrain|water|road|zoning|building|rci|traffic|interaction|visual|performance|release)/;

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  if (!(await exists(dir))) return [];
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

const readRepoText = (file) => readFile(path.join(repoRoot, file), 'utf8');

async function readGameTestFileCount() {
  const files = (
    await Promise.all([
      walk(path.join(repoRoot, 'apps/game/src')),
      walk(path.join(repoRoot, 'apps/game/test')),
    ])
  )
    .flat()
    .filter((file) => file.endsWith('.test.ts'));
  return files.length;
}

async function runVitestList() {
  const { stdout } = await execFileAsync(
    'pnpm',
    ['--filter', '@web-three-city/game', 'exec', 'vitest', 'list', '--json'],
    { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 },
  );
  // pnpm may prefix the JSON with engine/registry warnings on stdout; parse
  // the first JSON array instead of requiring clean output.
  const jsonStart = stdout.indexOf('[');
  if (jsonStart === -1) throw new Error(`vitest-list:missing-json\n${stdout.slice(0, 200)}`);
  const listed = JSON.parse(stdout.slice(jsonStart));
  if (!Array.isArray(listed)) throw new Error('vitest-list:expected-array');
  return listed;
}

async function browserSpecFiles() {
  return (await readdir(path.join(repoRoot, 'browser-tests'), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
    .map((entry) => entry.name)
    .sort();
}

async function runPlaywrightList(extraArgs = []) {
  const { stdout, stderr } = await execFileAsync(
    'pnpm',
    ['exec', 'playwright', 'test', '--list', '--project=chromium', ...extraArgs],
    { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 },
  );
  const output = `${stdout}\n${stderr}`;
  const match = output.match(/Total:\s+(\d+)\s+tests?/);
  if (match === null) throw new Error(`playwright-list:missing-total\n${output}`);
  return { testCount: Number(match[1]), output };
}

test('Game Vitest includes both source and test directories', async () => {
  const config = await readRepoText('apps/game/vitest.config.ts');
  assert.match(config, /src\/\*\*\/\*\.test\.ts/);
  assert.match(config, /test\/\*\*\/\*\.test\.ts/);
});

test('Game TypeScript includes browser-independent game tests', async () => {
  const config = await readRepoText('apps/game/tsconfig.json');
  assert.match(config, /"include"\s*:\s*\[[^\]]*"test"/s);
});

test('Game test inventory matches Vitest discovery', async () => {
  assert.equal(await readGameTestFileCount(), 83);
  assert.equal((await runVitestList()).length, 326);
});

test('every browser spec has approved ownership tags in its Playwright title path', async () => {
  const files = await browserSpecFiles();
  assert.equal(files.length, 33);
  for (const file of files) {
    assert.match(file, approvedDomainTag, `${file} has no domain ownership tag`);
    assert.match(file, approvedTag, `${file} has no approved browser tag`);
  }
});

test('full Chromium project has no tag exclusion', async () => {
  const config = await readRepoText('playwright.config.ts');
  const chromiumStart = config.indexOf("name: 'chromium'");
  assert.notEqual(chromiumStart, -1);
  const chromium = config.slice(chromiumStart);
  assert.doesNotMatch(chromium, /grep\s*:/);
  assert.doesNotMatch(chromium, /grepInvert\s*:/);
});

test('full Chromium list retains the current browser inventory', async () => {
  const listed = await runPlaywrightList();
  assert.equal(listed.testCount, 144);
});

test('approved targeted Playwright grep commands remain valid', async () => {
  for (const tag of ['@smoke', '@rci', '@release']) {
    const listed = await runPlaywrightList(['--grep', tag]);
    assert.ok(listed.testCount > 0, `${tag} must select at least one browser test`);
  }
});
