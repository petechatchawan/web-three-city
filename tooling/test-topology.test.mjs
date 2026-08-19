import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..');

async function readRepoText(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

async function recursivelyListFiles(directory, predicate) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await recursivelyListFiles(fullPath, predicate)));
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

async function browserSpecFiles() {
  const browserRoot = path.join(repoRoot, 'browser-tests');
  return (await recursivelyListFiles(browserRoot, (file) => file.endsWith('.spec.ts'))).map((file) =>
    path.relative(repoRoot, file).split(path.sep).join('/'),
  );
}

const approvedTag = /@(smoke|visual|release)(?=\b|@|-)/;
const approvedDomainTag = /@(terrain|road|zone|building|traffic|economy|ui)(?=\b|@|-)/;

async function readGameTestFileCount() {
  const roots = ['apps/game/src', 'apps/game/test'];
  let count = 0;
  for (const relativeRoot of roots) {
    const absoluteRoot = path.join(repoRoot, relativeRoot);
    count += (await recursivelyListFiles(absoluteRoot, (file) => file.endsWith('.test.ts'))).length;
  }
  return count;
}

async function runVitestList() {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [
      path.join(repoRoot, 'node_modules/vitest/vitest.mjs'),
      'list',
      '--config',
      path.join(repoRoot, 'apps/game/vitest.config.ts'),
    ],
    {
      cwd: repoRoot,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const output = `${stdout}\n${stderr}`;
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('apps/game/'));
}

async function listChromiumTests(grep) {
  const args = [
    path.join(repoRoot, 'node_modules/@playwright/test/cli.js'),
    'test',
    '--list',
    '--project=chromium',
  ];
  if (grep !== undefined) args.push('--grep', grep);
  const { stdout, stderr } = await execFileAsync(process.execPath, args, {
    cwd: repoRoot,
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${stdout}\n${stderr}`;
  const match = output.match(/Total:\s+(\d+)\s+tests?/);
  assert.ok(match, `Unable to parse Playwright test count from:\n${output}`);
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
  assert.equal((await runVitestList()).length, 340);
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
  assert.ok(chromiumStart >= 0, 'chromium project is missing');
  const nextProject = config.indexOf("name: '", chromiumStart + 1);
  const chromiumBlock = config.slice(
    chromiumStart,
    nextProject >= 0 ? nextProject : config.length,
  );
  assert.doesNotMatch(chromiumBlock, /grepInvert/);
});

test('full Chromium list retains the current browser inventory', async () => {
  const { testCount } = await listChromiumTests();
  assert.equal(testCount, 144);
});

test('approved targeted Playwright grep commands remain valid', async () => {
  const expectations = new Map([
    ['@terrain', 47],
    ['@road', 46],
    ['@zone', 23],
    ['@building', 18],
    ['@traffic', 11],
    ['@economy', 10],
    ['@ui', 20],
    ['@smoke', 35],
    ['@visual', 22],
    ['@release', 22],
  ]);
  for (const [grep, expectedCount] of expectations) {
    const { testCount } = await listChromiumTests(grep);
    assert.equal(testCount, expectedCount, `${grep} targeted list drifted`);
  }
});
