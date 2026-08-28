import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function git(rootDir: string, args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', [...args], { cwd: rootDir });
  return stdout.trim();
}

export interface RepositoryStateOptions {
  readonly expectHead?: string;
}

export interface RepositoryState {
  readonly head: string;
  readonly clean: boolean;
  readonly diffCheckClean: boolean;
}

export async function verifyRepositoryState(
  rootDir: string,
  options: RepositoryStateOptions = {},
): Promise<RepositoryState> {
  const head = await git(rootDir, ['rev-parse', 'HEAD']);
  if (options.expectHead !== undefined && head !== options.expectHead) {
    throw new Error(`Repository HEAD mismatch: expected ${options.expectHead}, actual ${head}`);
  }

  let diffCheckClean = true;
  try {
    await execFileAsync('git', ['diff', '--check', 'HEAD'], { cwd: rootDir });
  } catch (error) {
    diffCheckClean = false;
    throw new Error(`git diff --check failed: ${String(error)}`);
  }

  const status = await git(rootDir, ['status', '--porcelain=v1', '--untracked-files=all']);
  const clean = status.length === 0;
  if (!clean) throw new Error(`Repository worktree is not clean:\n${status}`);

  return { head, clean, diffCheckClean };
}
