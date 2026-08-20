import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const approvedDomainTag = /@(terrain|road|zone|building|traffic|ui|persistence|bootstrap)\b/;
const approvedTag = /@(terrain|road|zone|building|traffic|ui|persistence|bootstrap|full-browser)\b/;

async function readRepoText(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

async function collectFiles(relativeDir, predicate) {
  const absoluteDir = path.join(root, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(relativePath, predicate)));
    } else if (predicate(relativePath)) {
      files.push(relativePath.replaceAll(path.sep, '/'));
    }
  }
  return files.sort();
}

async function browserSpecFiles() {
  return collectFiles('tests/browser', (file) => file.endsWith('.spec.ts'));
}

async function readGameTestFileCount() {
  const sourceTests = await collectFiles('apps/game/src', (file) => file.endsWith('.test.ts'));
  const fixtureTests = await collectFiles('apps/game/test', (file) => file.endsWith('.test.ts'));
  return sourceTests.length + fixtureTests.length;
}

async function runPlaywrightList(args = []) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      path.join(root, 'node_modules', '@playwright', 'test', 'cli.js'),
      'test',
      '--list',
      '--project=chromium',
      ...args,
    ],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 },
  );
  return stdout;
}

async function runVitestList() {
  const { stdout } = await execFileAsync(
    path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vitest.cmd' : 'vitest'),
    ['list', '--config', 'apps/game/vitest.config.ts'],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 },
  );
  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function playwrightTestCount(output) {
  const match = /Total:\s+(\d+) tests? in \d+ files?/u.exec(output);
  assert.ok(match, `unable to parse Playwright test count from:\n${output}`);
  return Number(match[1]);
}

function playwrightListedCount(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^\[chromium\]\s+›/u.test(line)).length;
}

function targetedCount(output) {
  const match = /Total:\s+(\d+) tests? in \d+ files?/u.exec(output);
  assert.ok(match, `unable to parse targeted Playwright test count from:\n${output}`);
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
  assert.equal(await readGameTestFileCount(), 86);
  assert.equal((await runVitestList()).length, 341);
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
  const nextProject = config.indexOf("name: '", chromiumStart + 10);
  const chromiumBlock = config.slice(chromiumStart, nextProject === -1 ? undefined : nextProject);
  assert.doesNotMatch(chromiumBlock, /grepInvert/u);
});

test('full Chromium list retains the current browser inventory', async () => {
  const output = await runPlaywrightList();
  assert.equal(playwrightTestCount(output), 149);
  assert.equal(playwrightListedCount(output), 149);
});

test('approved targeted Playwright grep commands remain valid', async () => {
  for (const tag of ['@terrain', '@road', '@zone', '@building', '@traffic', '@ui', '@persistence', '@bootstrap']) {
    const result = targetedCount(await runPlaywrightList(['--grep', tag]));
    assert.ok(result.testCount > 0, `${tag} must select at least one Chromium browser test`);
  }
});

test('repository exposes the fast verification command', async () => {
  const packageJson = JSON.parse(await readRepoText('package.json'));
  assert.equal(packageJson.scripts.verify, 'pnpm check');
});

test('repository exposes the full release verification command', async () => {
  const packageJson = JSON.parse(await readRepoText('package.json'));
  assert.equal(
    packageJson.scripts['verify:full'],
    'pnpm install --frozen-lockfile && pnpm verify && pnpm exec playwright install chromium && pnpm test:browser:only && node tooling/verify-clean-worktree.mjs',
  );
});

test('deployment tests cover verification command contracts and clean-worktree behavior', async () => {
  const packageJson = JSON.parse(await readRepoText('package.json'));
  assert.match(packageJson.scripts['test:deployment'], /verification-scripts\.test\.mjs/u);
  assert.match(packageJson.scripts['test:deployment'], /verify-clean-worktree\.test\.mjs/u);
});

test('ESLint excludes generated browser evidence', async () => {
  const config = await readRepoText('eslint.config.mjs');
  assert.match(config, /test-results/u);
  assert.match(config, /playwright-report/u);
});

test('Playwright serializes CI browser workers while retaining local parallelism', async () => {
  const config = await readRepoText('playwright.config.ts');
  assert.match(config, /workers:\s*process\.env\.CI\s*\?\s*1\s*:\s*undefined/u);
});

test('architecture contracts run before recursive package tests', async () => {
  const packageJson = JSON.parse(await readRepoText('package.json'));
  assert.match(packageJson.scripts.test, /pnpm -r --if-present test/u);
  assert.match(packageJson.scripts.check, /pnpm test:deployment && pnpm test/u);
});
