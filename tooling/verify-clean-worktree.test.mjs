import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function createRepository() {
  const cwd = await mkdtemp(join(tmpdir(), 'verify-clean-worktree-'));
  await execFileAsync('git', ['init'], { cwd });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd });
  await execFileAsync('git', ['config', 'user.name', 'Verification Test'], { cwd });
  await writeFile(join(cwd, 'tracked.txt'), 'clean\n');
  await execFileAsync('git', ['add', 'tracked.txt'], { cwd });
  await execFileAsync('git', ['commit', '-m', 'test: seed repository'], { cwd });
  return cwd;
}

test('accepts a clean committed worktree', async () => {
  const { verifyCleanWorktree } = await import('./verify-clean-worktree.mjs');
  const cwd = await createRepository();
  await assert.doesNotReject(() => verifyCleanWorktree({ cwd }));
});

test('rejects tracked or untracked worktree changes', async () => {
  const { verifyCleanWorktree } = await import('./verify-clean-worktree.mjs');
  const cwd = await createRepository();
  await writeFile(join(cwd, 'tracked.txt'), 'dirty\n');
  await assert.rejects(() => verifyCleanWorktree({ cwd }), /working tree is not clean/i);
});
