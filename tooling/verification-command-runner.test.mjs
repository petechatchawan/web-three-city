import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildExecutionCommands,
  runCommand,
  runExecutionPlan,
} from './verification/command-runner.mjs';

test('builds owner, typecheck, and targeted browser commands as safe argument arrays', () => {
  const commands = buildExecutionCommands({
    ownerTests: [
      {
        workspace: '@web-three-city/traffic-core',
        files: [],
        mode: 'package',
      },
      {
        workspace: '@web-three-city/game',
        files: ['apps/game/src/traffic-release-fixture.test.ts'],
        mode: 'files',
      },
    ],
    consumerTests: [],
    typechecks: ['@web-three-city/traffic-core'],
    deploymentChecks: false,
    browser: {
      mode: 'targeted',
      tags: ['@traffic'],
      fullBrowserRequired: false,
    },
  });

  assert.deepEqual(commands, [
    {
      kind: 'owner-test',
      executable: 'pnpm',
      args: ['--filter', '@web-three-city/traffic-core', 'test'],
    },
    {
      kind: 'owner-test',
      executable: 'pnpm',
      args: [
        '--filter',
        '@web-three-city/game',
        'exec',
        'vitest',
        'run',
        'src/traffic-release-fixture.test.ts',
      ],
    },
    {
      kind: 'typecheck',
      executable: 'pnpm',
      args: ['--filter', '@web-three-city/traffic-core', 'typecheck'],
    },
    {
      kind: 'browser',
      executable: 'pnpm',
      args: ['exec', 'playwright', 'test', '--grep', '@traffic', '--project=chromium'],
    },
  ]);
});

test('keeps shell metacharacters inside one file argument', () => {
  const file = 'apps/game/src/fixture with spaces;$(touch-do-not-run).test.ts';
  const [command] = buildExecutionCommands({
    ownerTests: [{ workspace: '@web-three-city/game', files: [file], mode: 'files' }],
    consumerTests: [],
    typechecks: [],
    deploymentChecks: false,
    browser: { mode: 'none', tags: [], fullBrowserRequired: false },
  });

  assert.equal(command.executable, 'pnpm');
  assert.equal(command.args.at(-1), 'src/fixture with spaces;$(touch-do-not-run).test.ts');
  assert.equal(
    command.args.some((arg) => arg.includes('touch-do-not-run')),
    true,
  );
});

test('normalizes repository-root game test paths for workspace execution', () => {
  const [command] = buildExecutionCommands({
    ownerTests: [
      {
        workspace: '@web-three-city/game',
        files: ['apps/game/src/application/economy-browser-replacement.test.ts'],
        mode: 'files',
      },
    ],
    consumerTests: [],
    typechecks: [],
    deploymentChecks: false,
    browser: { mode: 'none', tags: [], fullBrowserRequired: false },
  });

  assert.deepEqual(command.args, [
    '--filter',
    '@web-three-city/game',
    'exec',
    'vitest',
    'run',
    'src/application/economy-browser-replacement.test.ts',
  ]);
});

test('runCommand passes executable and arguments without shell interpolation', async () => {
  const calls = [];
  const result = await runCommand({
    executable: 'pnpm',
    args: ['--filter', '@web-three-city/game', 'test'],
    cwd: '/tmp/project with spaces',
    execFileImpl: async (executable, args, options) => {
      calls.push({ executable, args, options });
      return { stdout: 'pass', stderr: '' };
    },
  });

  assert.equal(result.stdout, 'pass');
  assert.deepEqual(calls, [
    {
      executable: 'pnpm',
      args: ['--filter', '@web-three-city/game', 'test'],
      options: { cwd: '/tmp/project with spaces' },
    },
  ]);
});

test('skip-browser execution leaves browser authority for the Browser job', async () => {
  const calls = [];
  const result = await runExecutionPlan(
    {
      ownerTests: [],
      consumerTests: [],
      typechecks: [],
      deploymentChecks: false,
      browser: { mode: 'targeted', tags: ['@traffic'], fullBrowserRequired: false },
    },
    {
      skipBrowser: true,
      execFileImpl: async (executable, args) => {
        calls.push({ executable, args });
        return { stdout: '', stderr: '' };
      },
    },
  );

  assert.deepEqual(result.commands, []);
  assert.deepEqual(calls, []);
});
