import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const approvedTag = /@(smoke|release|interaction|e2e|visual)/;
const approvedDomainTag = /@(terrain|road|zoning|building|economy|rci|simulation|water|interaction)/;

async function readRepoText(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

async function filesUnder(directory) {
  const absolute = path.join(root, directory);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(relative)));
    else files.push(relative);
  }
  return files;
}

async function readGameTestFileCount() {
  const files = await filesUnder('apps/game');
  return files.filter((file) => file.endsWith('.test.ts')).length;
}

async function browserSpecFiles() {
  const entries = await readdir(path.join(root, 'browser-tests'), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
    .map((entry) => entry.name)
    .sort();
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += String(chunk)));
    child.stderr.on('data', (chunk) => (stderr += String(chunk)));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} ${args.join(' ')} failed (${code})\n${stdout}\n${stderr}`));
    });
  });
}

async function runVitestList() {
  const output = await run('pnpm', ['--filter', '@web-three-city/game', 'exec', 'vitest', 'list']);
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

async function runPlaywrightList(extraArgs = []) {
  const output = await run('pnpm', [
    'exec',
    'playwright',
    'test',
    '--project=chromium',
    '--list',
    ...extraArgs,
  ]);
  const match = output.match(/Total:\s+(\d+) tests?/);
  assert.ok(match, `Could not find Playwright list total in:\n${output}`);
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
  assert.equal(await readGameTestFileCount(), 75);
  assert.equal((await runVitestList()).length, 306);
});

test('every browser spec has approved ownership tags in its Playwright title path', async () => {
  const files = await browserSpecFiles();
  assert.equal(files.length, 27);
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
  assert.equal(listed.testCount, 132);
});

test('approved targeted Playwright grep commands remain valid', async () => {
  for (const tag of ['@smoke', '@rci', '@release']) {
    const listed = await runPlaywrightList(['--grep', tag]);
    assert.ok(listed.testCount > 0, `${tag} must select at least one browser test`);
  }
});
