import assert from 'node:assert/strict';
import test from 'node:test';

import { buildExecutionCommands, runCommand } from './verification/command-runner.mjs';

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
        'apps/game/src/traffic-release-fixture.test.ts',
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
  assert.equal(command.args.at(-1), file);
  assert.equal(
    command.args.some((arg) => arg.includes('touch-do-not-run')),
    true,
  );
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
