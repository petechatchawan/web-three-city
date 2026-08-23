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
  const jobs = {};
  for (const name of [
    'plan',
    'lint',
    'tests',
    'consumers',
    'typecheck',
    'deployment',
    'browser_build',
    'lean',
    'browser',
    'browser_full',
  ]) {
    const text = jobBlock(workflow, name);
    jobs[name] = { text, if: jobCondition(text) };
  }
  return jobs;
}

test('Lean aggregates the affected non-browser verification lanes', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.lean.text, /needs:\s*\[lint, tests, consumers, typecheck, deployment\]/);
  assert.match(jobs.lean.text, /Aggregate affected verification lanes/);
  assert.doesNotMatch(jobs.lean.text, /pnpm check/);
});

test('full-ci label selects Full Browser without serializing behind Lean', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(
    jobs.plan.text,
    /contains\(github\.event\.pull_request\.labels\.\*\.name, 'full-ci'\)/,
  );
  assert.match(jobs.browser_build.text, /needs:\s*plan/);
  assert.match(jobs.browser.text, /needs:\s*browser_build/);
  assert.doesNotMatch(jobs.browser.text, /needs:\s*lean/);
  assert.equal(jobs.browser_build.if.includes("needs.plan.outputs.mode != 'none'"), true);
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
  assert.match(jobs.plan.text, /github\.event_name == 'schedule'/);
  assert.match(jobs.plan.text, /EXPLICIT_FULL/);
  assert.match(jobs.browser_full.text, /Confirm Full Browser mode/);
  assert.match(jobs.browser_full.text, /Run Full Browser spec shard/);
  assert.match(jobs.browser_full.if, /outputs\.mode == 'full'/);
  assert.doesNotMatch(jobs.browser.if, /github\.event_name == 'pull_request'/);
});

test('CI dependency installs disable lifecycle scripts', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  for (const name of [
    'lint',
    'tests',
    'consumers',
    'typecheck',
    'deployment',
    'browser_build',
    'browser',
    'browser_full',
  ]) {
    assert.match(jobs[name].text, /pnpm install --frozen-lockfile --ignore-scripts/);
  }
});

test('Browser installs Chromium through the frozen local Playwright binary', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.browser.text, /\.\/node_modules\/\.bin\/playwright install chromium/);
  assert.doesNotMatch(jobs.browser.text, /pnpm exec playwright install chromium/);
});

test('Browser job consumes Lean build artifacts instead of rerunning Lean verification', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.browser_build.text, /actions\/download-artifact@v4/);
  assert.match(jobs.browser_build.text, /name:\s*affected-plan/);
  assert.match(jobs.browser_build.text, /pnpm build:browser/);
  assert.match(jobs.browser_build.text, /name:\s*browser-builds/);
  assert.match(jobs.browser.text, /actions\/download-artifact@v4/);
  assert.match(jobs.browser.text, /name:\s*browser-builds/);
  assert.match(jobs.browser_full.text, /name:\s*browser-builds/);
  assert.match(jobs.browser_full.text, /--shard=\$\{\{ matrix\.shard \}\}\/2/);
  assert.doesNotMatch(jobs.browser.text + jobs.browser_full.text, /pnpm verify:full/);
  assert.doesNotMatch(
    jobs.browser.text + jobs.browser_full.text,
    /pnpm (verify|check|build(?:\b|:))/,
  );
  assert.match(jobs.browser.text, /test -d apps\/game\/dist/);
  assert.match(jobs.browser.text, /test -d apps\/terrain-lab\/dist/);
});

test('Browser restores artifacts without leaving verification debris', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.browser.text, /rm browser-builds\.tar\.gz/);
  assert.match(jobs.browser.text, /node tooling\/verify-clean-worktree\.mjs/);
  assert.ok(
    jobs.browser.text.indexOf('Run planned targeted browser verification') <
      jobs.browser.text.indexOf('node tooling/verify-clean-worktree.mjs'),
  );
});

test('Browser build uploads exactly the browser preview build outputs', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(
    jobs.browser_build.text,
    /tar -czf browser-builds\.tar\.gz apps\/game\/dist apps\/terrain-lab\/dist/,
  );
  assert.match(jobs.browser_build.text, /name:\s*browser-builds/);
  assert.match(jobs.browser_build.text, /path:\s*browser-builds\.tar\.gz/);
});

test('Plan computes and publishes one exact-head affected execution plan', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.plan.text, /fetch-depth:\s*0/);
  assert.match(
    jobs.plan.text,
    /node tooling\/verify-affected\.mjs --base "\$BASE_SHA" --head "\$HEAD_SHA" --output affected-verification-plan\.json --plan-only --json/,
  );
  assert.match(jobs.plan.text, /affected-verification-plan\.json/);
  assert.match(jobs.plan.text, /actions\/upload-artifact@v4[\s\S]*name:\s*affected-plan/);
});

test('Browser consumes the Lean affected plan for targeted or Full Browser execution', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.browser.text, /affected-verification-plan\.json/);
  assert.match(jobs.browser.text, /Resolve affected verification plan/);
  assert.match(jobs.browser.text, /fullBrowserRequired/);
  assert.match(jobs.browser.text, /browserTags|browser\.tags|tags/);
  assert.match(jobs.browser.text, /Run planned targeted browser verification/);
  assert.match(jobs.browser_full.text, /Confirm Full Browser mode/);
  assert.match(jobs.browser_full.text, /Run Full Browser spec shard/);
});

test('Browser job retains failure artifacts', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.browser.text, /if:\s*always\(\)/);
  assert.match(jobs.browser.text, /name:\s*browser-evidence/);
  assert.match(jobs.browser.text, /playwright-report/);
  assert.match(jobs.browser.text, /test-results/);
});

test('affected plan selects targeted browser ownership sets', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  const browser = jobs.browser.text;
  assert.match(browser, /Resolve affected verification plan/);
  assert.match(browser, /browser\.tags\.join\('\|'\)/);
  assert.match(browser, /playwright test --grep "\$GREP" --project=chromium/);
  assert.match(jobs.browser_full.text, /Run Full Browser spec shard/);
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

test('affected verification fans out from the existing plan before Lean aggregates it', async () => {
  const workflow = await readRepoText('.github/workflows/ci.yml');
  for (const job of [
    'plan',
    'lint',
    'tests',
    'consumers',
    'typecheck',
    'deployment',
    'browser_build',
    'lean',
    'browser',
  ]) {
    assert.match(workflow, new RegExp(`^  ${job}:$`, 'm'), `missing CI job: ${job}`);
  }

  for (const job of ['lint', 'tests', 'consumers', 'typecheck', 'deployment', 'browser_build']) {
    const block = jobBlock(workflow, job);
    assert.match(block, /needs:\s*plan/, `${job} must consume the existing affected plan`);
    assert.doesNotMatch(block, /needs:\s*lean/, `${job} must not wait for aggregate Lean CI`);
  }

  const lean = jobBlock(workflow, 'lean');
  assert.match(lean, /needs:/, 'Lean must aggregate the parallel non-browser lanes');
  const browser = jobBlock(workflow, 'browser');
  assert.match(
    browser,
    /needs:\s*browser_build/,
    'Browser must wait for the exact browser artifact',
  );
  assert.doesNotMatch(browser, /needs:\s*lean/, 'Browser must not be serialized behind Lean CI');
});

test('normal pull requests use the affected Browser plan instead of unconditional Browser execution', async () => {
  const workflow = await readRepoText('.github/workflows/ci.yml');
  const browser = jobBlock(workflow, 'browser');
  assert.match(browser, /affected-verification-plan\.json/);
  assert.match(browser, /browser\.mode|mode/);
  assert.match(browser, /Run planned targeted browser verification/);
  assert.doesNotMatch(browser, /github\.event_name == ['"]pull_request['"]\s*$/m);
  assert.match(browser, /full-ci/);
});

test('Full Browser runs as two exact spec shards with one worker each', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.browser_full.text, /strategy:/);
  assert.match(jobs.browser_full.text, /shard:\s*\[1,\s*2\]/);
  assert.match(jobs.browser_full.text, /fail-fast:\s*false/);
  assert.match(jobs.browser_full.text, /needs:\s*browser_build/);
  assert.match(jobs.browser_full.if, /outputs\.mode == 'full'/);
  assert.match(jobs.browser_full.text, /--workers=1/);
  assert.match(jobs.browser_full.text, /--shard=\$\{\{ matrix\.shard \}\}\/2/);
  assert.doesNotMatch(jobs.browser_full.text, /pnpm verify:full/);
});
