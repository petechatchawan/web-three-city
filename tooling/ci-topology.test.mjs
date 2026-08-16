import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readRepoText = (path) => readFile(resolve(REPO_ROOT, path), 'utf8');
const readRepoJson = async (path) => JSON.parse(await readRepoText(path));

function jobBlock(workflow, name) {
  const lines = workflow.split('\n');
  const start = lines.findIndex((line) => line === `  ${name}:`);
  assert.notEqual(start, -1, `missing workflow job: ${name}`);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^ {2}[a-zA-Z0-9_-]+:$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function jobCondition(text) {
  const lines = text.split('\n');
  const index = lines.findIndex((line) => /^ {4}if:/.test(line));
  if (index < 0) return undefined;
  const first = lines[index].replace(/^ {4}if:\s*/, '').trim();
  if (!['>-', '>', '|-', '|'].includes(first)) return first;
  const values = [];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (/^ {4}\S/.test(line)) break;
    values.push(line.trim());
  }
  return values.join(' ');
}

async function readWorkflowJobs(path) {
  const workflow = await readRepoText(path);
  const leanText = jobBlock(workflow, 'lean');
  const browserText = jobBlock(workflow, 'browser');
  return {
    lean: { text: leanText, if: jobCondition(leanText) },
    browser: { text: browserText, if: jobCondition(browserText) },
  };
}

function evaluateWorkflowCondition(condition, context) {
  if (condition === undefined || condition.trim() === '' || condition.trim() === 'true') return true;
  const normalized = condition.replace(/\s+/g, ' ');
  if (
    normalized.includes("github.event_name == 'workflow_dispatch'") &&
    context.event === 'workflow_dispatch'
  ) {
    return true;
  }
  if (
    normalized.includes("github.event_name == 'schedule'") &&
    context.event === 'schedule'
  ) {
    return true;
  }
  if (
    normalized.includes("github.event_name == 'pull_request'") &&
    normalized.includes("contains(github.event.pull_request.labels.*.name, 'full-ci')")
  ) {
    return context.event === 'pull_request' && (context.labels?.includes('full-ci') ?? false);
  }
  if (normalized.includes("github.event.action != 'labeled'")) return context.action !== 'labeled';
  return false;
}

test('Lean remains the repository verification owner', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.lean.text, /pnpm check/);
  assert.match(jobs.lean.text, /node-version:\s*22/);
});

test('full-ci label event runs Lean before Browser', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.doesNotMatch(jobs.lean.text, /github\.event\.action\s*!=\s*['"]labeled['"]/);
  assert.match(jobs.browser.text, /needs:\s*lean/);
  assert.equal(
    evaluateWorkflowCondition(jobs.lean.if ?? 'true', {
      event: 'pull_request',
      action: 'labeled',
      labels: ['full-ci'],
    }),
    true,
  );
  assert.equal(
    evaluateWorkflowCondition(jobs.browser.if, {
      event: 'pull_request',
      action: 'labeled',
      labels: ['full-ci'],
    }),
    true,
  );
});

test('workflow triggers include labeled pull requests and manual dispatch', async () => {
  const workflow = await readRepoText('.github/workflows/ci.yml');
  assert.match(workflow, /types:\s*\[opened,\s*synchronize,\s*reopened,\s*labeled\]/);
  assert.match(workflow, /workflow_dispatch:/);
});

test('Full Browser remains opt-in for pull requests and runs as nightly regression', async () => {
  const workflow = await readRepoText('.github/workflows/ci.yml');
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(workflow, /schedule:\s*\n\s*- cron:\s*['"]0 18 \* \* \*['"]/);
  assert.match(jobs.browser.if, /github\.event_name == 'schedule'/);
  assert.equal(
    evaluateWorkflowCondition(jobs.browser.if, {
      event: 'pull_request',
      action: 'synchronize',
      labels: [],
    }),
    false,
  );
  assert.equal(
    evaluateWorkflowCondition(jobs.browser.if, {
      event: 'schedule',
      labels: [],
    }),
    true,
  );
});

test('CI dependency installs disable lifecycle scripts', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.lean.text, /pnpm install --frozen-lockfile --ignore-scripts/);
  assert.match(jobs.browser.text, /pnpm install --frozen-lockfile --ignore-scripts/);
});

test('Browser installs Chromium through the frozen local Playwright binary', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.browser.text, /\.\/node_modules\/\.bin\/playwright install chromium/);
  assert.doesNotMatch(jobs.browser.text, /pnpm exec playwright install chromium/);
});

test('Browser job consumes Lean build artifacts instead of rerunning Lean verification', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.browser.text, /actions\/download-artifact@v4/);
  assert.match(jobs.browser.text, /name:\s*lean-builds/);
  assert.match(jobs.browser.text, /pnpm test:browser:only/);
  assert.doesNotMatch(jobs.browser.text, /pnpm verify:full/);
  assert.doesNotMatch(jobs.browser.text, /pnpm (verify|check|build(?:\b|:))/);
  assert.match(jobs.browser.text, /test -d apps\/game\/dist/);
  assert.match(jobs.browser.text, /test -d apps\/terrain-lab\/dist/);
});

test('Browser restores artifacts without leaving verification debris', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.browser.text, /rm lean-builds\.tar\.gz/);
  assert.match(jobs.browser.text, /node tooling\/verify-clean-worktree\.mjs/);
  assert.ok(
    jobs.browser.text.indexOf('pnpm test:browser:only') <
      jobs.browser.text.indexOf('node tooling/verify-clean-worktree.mjs'),
  );
});

test('Lean uploads exactly the browser preview build outputs', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(
    jobs.lean.text,
    /tar -czf lean-builds\.tar\.gz apps\/game\/dist apps\/terrain-lab\/dist/,
  );
  assert.match(jobs.lean.text, /name:\s*lean-builds/);
  assert.match(jobs.lean.text, /path:\s*lean-builds\.tar\.gz/);
});

test('Browser job retains failure artifacts', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.browser.text, /if:\s*always\(\)/);
  assert.match(jobs.browser.text, /name:\s*browser-evidence/);
  assert.match(jobs.browser.text, /playwright-report/);
  assert.match(jobs.browser.text, /test-results/);
});

test('PR metadata can request whitelisted targeted browser ownership sets', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  const browser = jobs.browser.text;
  assert.match(browser, /Targeted browser tags:/);
  assert.match(browser, /Resolve targeted browser tags/);
  for (const tag of [
    'smoke',
    'terrain',
    'water',
    'road',
    'zoning',
    'building',
    'rci',
    'traffic',
    'interaction',
  ]) {
    assert.match(browser, new RegExp(`['"]${tag}['"]`));
  }
  assert.match(browser, /playwright test --grep "\$GREP" --project=chromium/);
  assert.match(browser, /Run full browser verification/);
  assert.match(browser, /contains\(github\.event\.pull_request\.labels\.\*\.name, 'full-ci'\)/);
});

test('Full browser release command remains available', async () => {
  const packageJson = await readRepoJson('package.json');
  assert.match(packageJson.scripts['verify:full'], /test:browser:only/);
});

test('CI topology contract runs in deployment verification', async () => {
  const packageJson = await readRepoJson('package.json');
  const deployment = packageJson.scripts['test:deployment'];
  assert.ok(
    deployment.indexOf('tooling/architecture-boundary.test.mjs') <
      deployment.indexOf('tooling/test-topology.test.mjs'),
  );
  assert.ok(
    deployment.indexOf('tooling/test-topology.test.mjs') <
      deployment.indexOf('tooling/ci-topology.test.mjs'),
  );
  assert.ok(
    deployment.indexOf('tooling/ci-topology.test.mjs') <
      deployment.indexOf('tooling/development-workflow.test.mjs'),
  );
});
