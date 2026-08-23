#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { buildAffectedExecutionPlan } from './verification/execution-plan.mjs';
import { runExecutionPlan } from './verification/command-runner.mjs';
import { resolveVerificationPlan } from './verification/resolver.mjs';

const execFileAsync = promisify(execFileCallback);
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const SAFE_GIT_REVISION = /^[A-Za-z0-9._~^/-]+$/;

const EXECUTION_LANES = Object.freeze({
  lint: ['lint'],
  'owner-tests': ['owner-test'],
  'consumer-tests': ['consumer-test'],
  typecheck: ['typecheck'],
  deployment: ['deployment'],
  browser: ['browser'],
});

export function parseArgs(argv) {
  const options = {
    baseSha: null,
    headSha: null,
    json: false,
    output: null,
    skipBrowser: false,
    lane: null,
    planOnly: false,
    planFile: null,
    githubEventFile: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') continue;
    if (argument === '--json') {
      options.json = true;
      continue;
    }
    if (argument === '--skip-browser') {
      options.skipBrowser = true;
      continue;
    }
    if (argument === '--plan-only') {
      options.planOnly = true;
      continue;
    }
    if (
      argument === '--base' ||
      argument === '--head' ||
      argument === '--output' ||
      argument === '--lane' ||
      argument === '--plan-file' ||
      argument === '--github-event-file'
    ) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === '--base') options.baseSha = value;
      if (argument === '--head') options.headSha = value;
      if (argument === '--output') options.output = value;
      if (argument === '--lane') {
        if (!Object.hasOwn(EXECUTION_LANES, value)) {
          throw new Error(`unknown execution lane: ${value}`);
        }
        options.lane = value;
      }
      if (argument === '--plan-file') options.planFile = value;
      if (argument === '--github-event-file') options.githubEventFile = value;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  if ((!options.baseSha || !options.headSha) && !options.planFile && !options.githubEventFile) {
    throw new Error(
      '--base and --head are required unless --plan-file or --github-event-file is used',
    );
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
  eventFile,
  headSha = process.env.GITHUB_SHA,
  readFileImpl = readFile,
}) {
  const event = JSON.parse(await readFileImpl(eventFile, 'utf8'));
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

export async function runAffectedVerification({
  baseSha,
  headSha,
  cwd = process.cwd(),
  execFileImpl = execFileAsync,
  skipBrowser = false,
  lane = null,
  planOnly = false,
  planFile = null,
  githubEventFile = null,
  githubHeadSha = process.env.GITHUB_SHA,
}) {
  const exactHeadProvided = Boolean(baseSha && headSha);
  if (githubEventFile) {
    const revisions = await readGithubEventRevisions({
      eventFile: githubEventFile,
      headSha: githubHeadSha,
    });
    baseSha ??= revisions.baseSha;
    headSha ??= revisions.headSha;
  }

  let changedFiles;
  let resolution;
  let plan;
  if (planFile) {
    const published = JSON.parse(await readFile(planFile, 'utf8'));
    changedFiles = published.changedFiles;
    resolution = published.resolution;
    plan = published.plan;
    if (!Array.isArray(changedFiles) || !resolution || !plan?.exactHead) {
      throw new Error('affected-plan:invalid-published-plan');
    }
    baseSha ??= plan.exactHead.baseSha;
    headSha ??= plan.exactHead.headSha;
    if (plan.exactHead.baseSha !== baseSha || plan.exactHead.headSha !== headSha) {
      throw new Error('affected-plan:exact-head-mismatch');
    }
    if (!exactHeadProvided && !githubEventFile) {
      const { stdout } = await execFileImpl('git', ['rev-parse', 'HEAD'], { cwd });
      if (stdout.trim() !== headSha) {
        throw new Error('affected-plan:checked-out-head-mismatch');
      }
    }
  } else {
    if (!baseSha || !headSha) {
      throw new Error('--base and --head are required for a new plan');
    }
    changedFiles = await readChangedFiles({ baseSha, headSha, cwd, execFileImpl });
    resolution = resolveVerificationPlan(changedFiles);
    plan = buildAffectedExecutionPlan(resolution, changedFiles, { baseSha, headSha });
  }
  const execution = planOnly
    ? { commands: [], results: [] }
    : await runExecutionPlan(plan, {
        cwd,
        execFileImpl,
        skipBrowser,
        kinds: executionKindsForLane(lane),
      });
  return { changedFiles, resolution, plan, execution };
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
