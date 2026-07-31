#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFileCallback);

export async function verifyCleanWorktree({
  cwd = process.cwd(),
  execFileImpl = execFileAsync,
} = {}) {
  await execFileImpl('git', ['diff', '--check'], { cwd });
  const { stdout } = await execFileImpl(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    { cwd },
  );

  const changes = stdout.trim();
  if (changes.length > 0) {
    throw new Error(`Working tree is not clean:\n${changes}`);
  }
}

async function main() {
  await verifyCleanWorktree();
  process.stdout.write('Working tree is clean.\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
