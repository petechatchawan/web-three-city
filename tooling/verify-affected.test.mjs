import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { parseArgs, readChangedFiles, runAffectedVerification } from './verify-affected.mjs';

test('parses exact-head affected verification arguments', () => {
  assert.deepEqual(
    parseArgs([
      '--',
      '--base',
      'base-sha',
      '--head',
      'head-sha',
      '--json',
      '--output',
      '/tmp/plan.json',
      '--skip-browser',
    ]),
    {
      baseSha: 'base-sha',
      headSha: 'head-sha',
      json: true,
      output: '/tmp/plan.json',
      skipBrowser: true,
      lane: null,
      planOnly: false,
      planFile: null,
    },
  );
});

test('reads changed paths through git argument arrays', async () => {
  const calls = [];
  const files = await readChangedFiles({
    baseSha: 'base sha',
    headSha: 'head;sha',
    cwd: '/tmp/project',
    execFileImpl: async (executable, args, options) => {
      calls.push({ executable, args, options });
      return {
        stdout: 'packages/traffic-core/src/graph.ts\n\nbrowser-tests/traffic.@traffic.spec.ts\n',
      };
    },
  });

  assert.deepEqual(files, [
    'browser-tests/traffic.@traffic.spec.ts',
    'packages/traffic-core/src/graph.ts',
  ]);
  assert.deepEqual(calls, [
    {
      executable: 'git',
      args: ['diff', '--name-only', '--diff-filter=ACMR', 'base sha...head;sha'],
      options: { cwd: '/tmp/project' },
    },
  ]);
});

test('parses execution lane and plan-only options for CI fan-out', () => {
  assert.deepEqual(
    parseArgs([
      '--base',
      'base-sha',
      '--head',
      'head-sha',
      '--lane',
      'owner-tests',
      '--plan-only',
      '--plan-file',
      '/tmp/plan.json',
    ]),
    {
      baseSha: 'base-sha',
      headSha: 'head-sha',
      json: false,
      output: null,
      skipBrowser: false,
      lane: 'owner-tests',
      planOnly: true,
      planFile: '/tmp/plan.json',
    },
  );
});

test('plan-only resolution publishes the exact plan without executing verification commands', async () => {
  const calls = [];
  const evidence = await runAffectedVerification({
    baseSha: 'base-sha',
    headSha: 'head-sha',
    planOnly: true,
    execFileImpl: async (executable, args, options) => {
      calls.push({ executable, args, options });
      return { stdout: 'packages/traffic-core/src/graph.ts\n', stderr: '' };
    },
  });

  assert.equal(evidence.plan.exactHead.headSha, 'head-sha');
  assert.deepEqual(evidence.execution, { commands: [], results: [] });
  assert.deepEqual(calls, [
    {
      executable: 'git',
      args: ['diff', '--name-only', '--diff-filter=ACMR', 'base-sha...head-sha'],
      options: { cwd: process.cwd() },
    },
  ]);
});

test('executes a published exact-head plan without recomputing changed files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'verify-affected-plan-'));
  const planFile = join(directory, 'affected-verification-plan.json');
  await writeFile(
    planFile,
    `${JSON.stringify({
      changedFiles: ['packages/traffic-core/src/graph.ts'],
      resolution: { systems: ['traffic-core'] },
      plan: {
        ownerTests: [{ workspace: '@web-three-city/traffic-core', files: [], mode: 'package' }],
        consumerTests: [],
        typechecks: [],
        deploymentChecks: false,
        lintFiles: [],
        browser: { mode: 'none', tags: [], fullBrowserRequired: false },
        exactHead: { baseSha: 'base-sha', headSha: 'head-sha' },
      },
    })}\n`,
    'utf8',
  );

  const calls = [];
  try {
    const evidence = await runAffectedVerification({
      baseSha: 'base-sha',
      headSha: 'head-sha',
      planFile,
      lane: 'owner-tests',
      execFileImpl: async (executable, args, options) => {
        calls.push({ executable, args, options });
        return { stdout: '', stderr: '' };
      },
    });

    assert.deepEqual(evidence.changedFiles, ['packages/traffic-core/src/graph.ts']);
    assert.deepEqual(
      evidence.execution.commands.map(({ kind }) => kind),
      ['owner-test'],
    );
    assert.equal(
      calls.some(({ executable }) => executable === 'git'),
      false,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
