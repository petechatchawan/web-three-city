import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFileCallback);

function packageTestCommand(target, kind) {
  if (target.mode === 'package') {
    return {
      kind,
      executable: 'pnpm',
      args: ['--filter', target.workspace, 'test'],
    };
  }

  if (target.mode === 'files') {
    return {
      kind,
      executable: 'pnpm',
      args: ['--filter', target.workspace, 'exec', 'vitest', 'run', ...target.files],
    };
  }

  return {
    kind,
    executable: 'pnpm',
    args: ['--filter', target.workspace, 'exec', 'vitest', 'related', ...target.files],
  };
}

/**
 * Convert an affected execution plan to explicit executable/argument tuples.
 * No command is interpolated into a shell string.
 */
export function buildExecutionCommands(plan) {
  const commands = [];
  for (const target of plan.ownerTests ?? [])
    commands.push(packageTestCommand(target, 'owner-test'));
  for (const target of plan.consumerTests ?? [])
    commands.push(packageTestCommand(target, 'consumer-test'));
  for (const workspace of plan.typechecks ?? []) {
    commands.push({
      kind: 'typecheck',
      executable: 'pnpm',
      args: ['--filter', workspace, 'typecheck'],
    });
  }
  if (plan.deploymentChecks) {
    commands.push({
      kind: 'deployment',
      executable: 'pnpm',
      args: ['test:deployment'],
    });
  }

  if (plan.browser?.mode === 'targeted') {
    const tags = plan.browser.tags.join('|');
    if (!tags) throw new Error('targeted browser execution requires at least one ownership tag');
    commands.push({
      kind: 'browser',
      executable: 'pnpm',
      args: ['exec', 'playwright', 'test', '--grep', tags, '--project=chromium'],
    });
  } else if (plan.browser?.mode === 'full') {
    commands.push({
      kind: 'browser',
      executable: 'pnpm',
      args: ['exec', 'playwright', 'test', '--project=chromium'],
    });
  }

  return commands;
}

export async function runCommand({
  executable,
  args,
  cwd = process.cwd(),
  execFileImpl = execFileAsync,
}) {
  return execFileImpl(executable, args, { cwd });
}

export async function runExecutionPlan(plan, options = {}) {
  const commands = buildExecutionCommands(plan).filter(
    (command) => !options.skipBrowser || command.kind !== 'browser',
  );
  const results = [];
  for (const command of commands) {
    const result = await runCommand({ ...command, ...options });
    results.push({
      kind: command.kind,
      executable: command.executable,
      args: command.args,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    });
  }
  return { commands, results };
}
