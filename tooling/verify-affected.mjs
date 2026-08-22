#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { buildAffectedExecutionPlan } from './verification/execution-plan.mjs';
import { runExecutionPlan } from './verification/command-runner.mjs';
import { resolveVerificationPlan } from './verification/resolver.mjs';

const execFileAsync = promisify(execFileCallback);
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

export function parseArgs(argv) {
  const options = { baseSha: null, headSha: null, json: false, output: null, skipBrowser: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') {
      options.json = true;
      continue;
    }
    if (argument === '--skip-browser') {
      options.skipBrowser = true;
      continue;
    }
    if (argument === '--base' || argument === '--head' || argument === '--output') {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === '--base') options.baseSha = value;
      if (argument === '--head') options.headSha = value;
      if (argument === '--output') options.output = value;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  if (!options.baseSha || !options.headSha) {
    throw new Error('--base and --head are required');
  }
  return options;
}

export async function readChangedFiles({
  baseSha,
  headSha,
  cwd = process.cwd(),
  execFileImpl = execFileAsync,
}) {
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
}) {
  const changedFiles = await readChangedFiles({ baseSha, headSha, cwd, execFileImpl });
  const resolution = resolveVerificationPlan(changedFiles);
  const plan = buildAffectedExecutionPlan(resolution, changedFiles, { baseSha, headSha });
  const execution = await runExecutionPlan(plan, { cwd, execFileImpl, skipBrowser });
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
