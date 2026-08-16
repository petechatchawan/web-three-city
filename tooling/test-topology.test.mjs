import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const approvedDomainTag = /@(terrain|water|road|zoning|building|rci|traffic)/;
const approvedTag = /@(smoke|visual|interaction|release|terrain|water|road|zoning|building|rci|traffic)/;

async function readRepoText(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

async function browserSpecFiles() {
  const entries = await readdir(path.join(root, 'browser-tests'), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
    .map((entry) => entry.name)
    .sort();
}

async function walkTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkTestFiles(target)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.test.ts')) files.push(target);
  }
  return files;
}

async function readGameTestFileCount() {
  const directories = [path.join(root, 'apps/game/src'), path.join(root, 'apps/game/test')];
  const files = [];
  for (const directory of directories) files.push(...(await walkTestFiles(directory)));
  return files.length;
}

function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed (${code})\n${stdout}\n${stderr}`));
    });
  });
}

async function runVitestList() {
  const { stdout, stderr } = await runCommand('pnpm', [
    '--filter',
    '@web-three-city/game',
    'exec',
    'vitest',
    'list',
    '--run',
  ]);
  const output = `${stdout}\n${stderr}`;
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('src/') || line.startsWith('test/'));
  if (lines.length > 0) return lines;
  const match = output.match(/Tests\s+(\d+)/);
  if (match === null) throw new Error(`Unable to parse Game Vitest inventory:\n${output}`);
  return Array.from({ length: Number(match[1]) }, (_, index) => `test-${index + 1}`);
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
  assert.equal((await runVitestList()).length, 332);
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
  const nextProject = config.indexOf("name: '", chromiumStart + 1);
  const chromiumBlock = config.slice(
    chromiumStart,
    nextProject === -1 ? config.length : nextProject,
  );
  assert.doesNotMatch(chromiumBlock, /grepInvert/);
});

test('full Chromium list retains the current browser inventory', async () => {
  const { stdout, stderr } = await runCommand(
    'pnpm',
    ['exec', 'playwright', 'test', '--project=chromium', '--list'],
    { CI: '1' },
  );
  const output = `${stdout}\n${stderr}`;
  const match = output.match(/Total:\s+(\d+) tests in (\d+) files/);
  assert.ok(match, `Unable to parse Playwright list output:\n${output}`);
  assert.equal(Number(match[1]), 144);
  assert.equal(Number(match[2]), 15);
});

test('approved targeted Playwright grep commands remain valid', async () => {
  for (const grep of ['@traffic', '@traffic|@building']) {
    const { stdout, stderr } = await runCommand(
      'pnpm',
      ['exec', 'playwright', 'test', '--project=chromium', '--list', '--grep', grep],
      { CI: '1' },
    );
    const output = `${stdout}\n${stderr}`;
    const match = output.match(/Total:\s+(\d+) tests in (\d+) files/);
    assert.ok(match, `Unable to parse targeted Playwright list output for ${grep}:\n${output}`);
    assert.ok(Number(match[1]) > 0, `${grep} must select at least one browser test`);
  }
});

test('repository exposes the fast verification command', async () => {
  const packageJson = JSON.parse(await readRepoText('package.json'));
  assert.equal(packageJson.scripts?.verify, 'pnpm check');
});

test('repository exposes the full release verification command', async () => {
  const packageJson = JSON.parse(await readRepoText('package.json'));
  assert.equal(
    packageJson.scripts?.['verify:full'],
    'pnpm install --frozen-lockfile && pnpm verify && pnpm exec playwright install chromium && pnpm test:browser:only && node tooling/verify-clean-worktree.mjs',
  );
});

test('deployment tests cover verification command contracts and clean-worktree behavior', async () => {
  const packageJson = JSON.parse(await readRepoText('package.json'));
  const command = packageJson.scripts?.['test:deployment'];
  assert.match(command, /verification-scripts\.test\.mjs/);
  assert.match(command, /verify-clean-worktree\.test\.mjs/);
});

test('ESLint excludes generated browser evidence', async () => {
  const config = await readRepoText('eslint.config.js');
  assert.match(config, /browser-evidence/);
  assert.match(config, /test-results/);
  assert.match(config, /playwright-report/);
});

test('Playwright serializes CI browser workers while retaining local parallelism', async () => {
  const config = await readRepoText('playwright.config.ts');
  assert.match(config, /workers:\s*process\.env\.CI\s*\?\s*1\s*:\s*undefined/);
});

test('architecture contracts run before recursive package tests', async () => {
  const packageJson = JSON.parse(await readRepoText('package.json'));
  assert.match(
    packageJson.scripts?.check,
    /pnpm provenance:check && pnpm test:deployment && pnpm test && pnpm build/,
  );
});
