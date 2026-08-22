import assert from 'node:assert/strict';
import test from 'node:test';

import { parseArgs, readChangedFiles } from './verify-affected.mjs';

test('parses exact-head affected verification arguments', () => {
  assert.deepEqual(
    parseArgs([
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
