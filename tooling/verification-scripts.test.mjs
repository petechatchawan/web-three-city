import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import test from 'node:test';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const eslintConfig = await readFile(new URL('../eslint.config.js', import.meta.url), 'utf8');
const playwrightConfig = await readFile(
  new URL('../playwright.config.ts', import.meta.url),
  'utf8',
);

const expectedFull =
  'pnpm install --frozen-lockfile && pnpm verify && pnpm exec playwright install chromium && pnpm test:browser:only && node tooling/verify-clean-worktree.mjs';

test('repository exposes the fast verification command', () => {
  assert.equal(packageJson.scripts.verify, 'pnpm check');
});

test('repository exposes the full release verification command', () => {
  assert.equal(packageJson.scripts['verify:full'], expectedFull);
});

test('deployment tests cover verification command contracts and clean-worktree behavior', () => {
  assert.match(packageJson.scripts['test:deployment'], /verification-scripts\.test\.mjs/);
  assert.match(packageJson.scripts['test:deployment'], /verify-clean-worktree\.test\.mjs/);
});

test('ESLint excludes generated browser evidence', () => {
  assert.match(eslintConfig, /\*\*\/playwright-report\/\*\*/);
  assert.match(eslintConfig, /\*\*\/test-results\/\*\*/);
});

test('Playwright uses deterministic browser-worker concurrency', () => {
  assert.match(playwrightConfig, /workers:\s*2,/);
});
