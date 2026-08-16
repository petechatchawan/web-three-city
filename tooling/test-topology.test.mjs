import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const toolingDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolingDir, '..');
const approvedTag = /@(smoke|interaction|visual|release)/;
const approvedDomainTag = /@(terrain|water|road|zoning|building|rci|traffic)/;

async function readRepoText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

async function walkFiles(directory, predicate) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...(await walkFiles(absolute, predicate)));
    else if (predicate(entry.name)) results.push(absolute);
  }
  return results.sort();
}

async function readGameTestFileCount() {
  const files = await Promise.all([
    walkFiles(path.join(repoRoot, 'apps/game/src'), (name) => name.endsWith('.test.ts')),
    walkFiles(path.join(repoRoot, 'apps/game/test'), (name) => name.endsWith('.test.ts')),
  ]);
  return files.flat().length;
}

async function browserSpecFiles() {
  return (await walkFiles(path.join(repoRoot, 'browser-tests'), (name) => name.endsWith('.spec.ts')))
    .map((file) => path.relative(repoRoot, file).replaceAll(path.sep, '/'))
    .sort();
}

async function runVitestList() {
  const { stdout, stderr } = await execFileAsync(
    'pnpm',
    ['--filter', '@web-three-city/game', 'exec', 'vitest', 'list', '--run'],
    { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 },
  );
  return `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('✓ '));
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
  const full = await runPlaywrightList();
  assert.equal(full.testCount, 144);
});

test('approved targeted Playwright grep commands remain valid', async () => {
  const commands = [
    '@terrain',
    '@water',
    '@road',
    '@zoning',
    '@building',
    '@rci',
    '@traffic',
    '@smoke',
    '@interaction',
    '@visual',
    '@release',
  ];
  for (const command of commands) {
    const result = await runPlaywrightList(['--grep', command]);
    assert.ok(result.testCount > 0, `${command} did not match any browser tests`);
  }
});

test('repository exposes the fast verification command', async () => {
  const rootPackage = JSON.parse(await readRepoText('package.json'));
  assert.equal(rootPackage.scripts['test:browser:smoke'], 'playwright test --grep @smoke');
});

test('repository exposes the full release verification command', async () => {
  const rootPackage = JSON.parse(await readRepoText('package.json'));
  assert.equal(rootPackage.scripts['test:browser:only'], 'playwright test --project=chromium');
});

test('deployment tests cover verification command contracts and clean-worktree behavior', async () => {
  const rootPackage = JSON.parse(await readRepoText('package.json'));
  assert.match(rootPackage.scripts['test:deployment'], /verification-scripts\.test\.mjs/);
  assert.match(rootPackage.scripts['test:deployment'], /verify-clean-worktree\.test\.mjs/);
});

test('ESLint excludes generated browser evidence', async () => {
  const config = await readRepoText('eslint.config.mjs');
  assert.match(config, /playwright-report/);
  assert.match(config, /test-results/);
});

test('Playwright serializes CI browser workers while retaining local parallelism', async () => {
  const config = await readRepoText('playwright.config.ts');
  assert.match(config, /workers:\s*process\.env\.CI\s*\?\s*1\s*:\s*2/);
});
