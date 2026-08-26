#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { buildAffectedExecutionPlan } from './verification/execution-plan.mjs';
import { runExecutionPlan } from './verification/command-runner.mjs';
import { resolveVerificationPlan } from './verification/resolver.mjs';

const execFileAsync = promisify(execFileCallback);
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const SAFE_GIT_REVISION = /^[A-Za-z0-9._~^/-]+$/;
const PUBLISHED_PLAN_FILE = 'affected-verification-plan.json';
const CI_EVENT_FILE = '.ci-event.json';

const EXECUTION_LANES = Object.freeze({
  lint: ['lint'],
  'owner-tests': ['owner-test'],
  'consumer-tests': ['consumer-test'],
  typecheck: ['typecheck'],
  deployment: ['deployment'],
  browser: ['browser'],
});

const FLAG_OPTIONS = Object.freeze({
  '--json': 'json',
  '--skip-browser': 'skipBrowser',
  '--plan-only': 'planOnly',
  '--github-event': 'githubEvent',
});

const VALUE_OPTIONS = new Set(['--base', '--head', '--output', '--lane', '--plan-file']);

function createParseOptions() {
  return {
    baseSha: null,
    headSha: null,
    json: false,
    output: null,
    skipBrowser: false,
    lane: null,
    planOnly: false,
    planFile: null,
    githubEvent: false,
  };
}

function applyValueOption(options, argument, value) {
  if (argument === '--base') options.baseSha = value;
  if (argument === '--head') options.headSha = value;
  if (argument === '--output') options.output = value;
  if (argument === '--lane') {
    if (!Object.hasOwn(EXECUTION_LANES, value)) {
      throw new Error(`unknown execution lane: ${value}`);
    }
    options.lane = value;
  }
  if (argument === '--plan-file') {
    if (value !== PUBLISHED_PLAN_FILE) {
      throw new Error(`affected-plan:file-name-must-be-${PUBLISHED_PLAN_FILE}`);
    }
    options.planFile = PUBLISHED_PLAN_FILE;
  }
}

export function parseArgs(argv) {
  const options = createParseOptions();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') continue;
    if (Object.hasOwn(FLAG_OPTIONS, argument)) {
      options[FLAG_OPTIONS[argument]] = true;
      continue;
    }
    if (VALUE_OPTIONS.has(argument)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      index += 1;
      applyValueOption(options, argument, value);
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  if ((!options.baseSha || !options.headSha) && !options.planFile && !options.githubEvent) {
    throw new Error('--base and --head are required unless --plan-file or --github-event is used');
  }
  return options;
}

export function assertSafeGitRevision(value, name) {
  if (typeof value !== 'string' || !SAFE_GIT_REVISION.test(value)) {
    throw new Error(`unsafe git revision: ${name}`);
  }
  return value;
}

export async function readGithubEventRevisions({
  cwd = process.cwd(),
  headSha = process.env.GITHUB_SHA,
  readFileImpl = readFile,
}) {
  const event = JSON.parse(await readFileImpl(join(cwd, CI_EVENT_FILE), 'utf8'));
  const baseSha = event.pull_request?.base?.sha ?? event.before ?? 'HEAD~1';
  assertSafeGitRevision(baseSha, 'baseSha');
  assertSafeGitRevision(headSha, 'headSha');
  return { baseSha, headSha };
}

export function executionKindsForLane(lane) {
  if (lane === null || lane === undefined) return undefined;
  return EXECUTION_LANES[lane];
}

export async function readChangedFiles({
  baseSha,
  headSha,
  cwd = process.cwd(),
  execFileImpl = execFileAsync,
}) {
  assertSafeGitRevision(baseSha, 'baseSha');
  assertSafeGitRevision(headSha, 'headSha');
  const { stdout } = await execFileImpl(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMR', `${baseSha}...${headSha}`],
    { cwd },
  );
  return [
    ...new Set(
      stdout
        .split(/\r?\n/)
        .map((file) => file.trim())
        .filter(Boolean),
    ),
  ].sort(compareText);
}

async function resolveInputRevisions({ baseSha, headSha, githubEvent, cwd }) {
  if (!githubEvent) return { baseSha, headSha };
  const revisions = await readGithubEventRevisions({ cwd, headSha });
  return {
    baseSha: baseSha ?? revisions.baseSha,
    headSha: headSha ?? revisions.headSha,
  };
}

function assertPublishedPlanShape(published) {
  if (
    !Array.isArray(published.changedFiles) ||
    !published.resolution ||
    !published.plan?.exactHead
  ) {
    throw new Error('affected-plan:invalid-published-plan');
  }
}

function resolvePublishedHead(published, baseSha, headSha) {
  const resolvedBaseSha = baseSha ?? published.plan.exactHead.baseSha;
  const resolvedHeadSha = headSha ?? published.plan.exactHead.headSha;
  if (
    published.plan.exactHead.baseSha !== resolvedBaseSha ||
    published.plan.exactHead.headSha !== resolvedHeadSha
  ) {
    throw new Error('affected-plan:exact-head-mismatch');
  }
  return { baseSha: resolvedBaseSha, headSha: resolvedHeadSha };
}

async function readPublishedVerificationPlan({
  cwd,
  baseSha,
  headSha,
  exactHeadProvided,
  githubEvent,
  execFileImpl,
}) {
  const published = JSON.parse(await readFile(join(cwd, PUBLISHED_PLAN_FILE), 'utf8'));
  assertPublishedPlanShape(published);
  const revisions = resolvePublishedHead(published, baseSha, headSha);
  if (!exactHeadProvided && !githubEvent) {
    const { stdout } = await execFileImpl('git', ['rev-parse', 'HEAD'], { cwd });
    if (stdout.trim() !== revisions.headSha) {
      throw new Error('affected-plan:checked-out-head-mismatch');
    }
  }
  return { ...published, ...revisions };
}

async function buildVerificationPlan({ baseSha, headSha, cwd, execFileImpl }) {
  if (!baseSha || !headSha) {
    throw new Error('--base and --head are required for a new plan');
  }
  const changedFiles = await readChangedFiles({ baseSha, headSha, cwd, execFileImpl });
  const resolution = resolveVerificationPlan(changedFiles);
  const plan = buildAffectedExecutionPlan(resolution, changedFiles, { baseSha, headSha });
  return { changedFiles, resolution, plan };
}

export async function runAffectedVerification({
  baseSha,
  headSha,
  cwd = process.cwd(),
  execFileImpl = execFileAsync,
  skipBrowser = false,
  lane = null,
  planOnly = false,
  planFile = null,
  githubEvent = false,
  githubHeadSha = process.env.GITHUB_SHA,
}) {
  const exactHeadProvided = Boolean(baseSha && headSha);
  ({ baseSha, headSha } = await resolveInputRevisions({
    baseSha,
    headSha: githubEvent ? githubHeadSha : headSha,
    githubEvent,
    cwd,
  }));
  const evidence = planFile
    ? await readPublishedVerificationPlan({
        cwd,
        baseSha,
        headSha,
        exactHeadProvided,
        githubEvent,
        execFileImpl,
      })
    : await buildVerificationPlan({ baseSha, headSha, cwd, execFileImpl });
  const execution = planOnly
    ? { commands: [], results: [] }
    : await runExecutionPlan(evidence.plan, {
        cwd,
        execFileImpl,
        skipBrowser,
        kinds: executionKindsForLane(lane),
      });
  return { ...evidence, execution };
}

function formatEvidence(evidence) {
  return [
    `Exact head: ${evidence.plan.exactHead.headSha}`,
    `Base: ${evidence.plan.exactHead.baseSha}`,
    `Changed files: ${evidence.changedFiles.length}`,
    `Owner targets: ${evidence.plan.ownerTests.length}`,
    `Consumer targets: ${evidence.plan.consumerTests.length}`,
    `Browser: ${evidence.plan.browser.mode}${evidence.plan.browser.tags.length ? ` (${evidence.plan.browser.tags.join(', ')})` : ''}`,
    'Affected verification completed.',
  ].join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const evidence = await runAffectedVerification(options);
  if (options.output) {
    await writeFile(options.output, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(
    `${options.json ? JSON.stringify(evidence, null, 2) : formatEvidence(evidence)}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
