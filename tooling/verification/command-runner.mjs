import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFileCallback);

function workspaceRoot(workspace) {
  const name = workspace.replace(/^@web-three-city\//, '');
  return name === 'game' || name === 'terrain-lab' ? `apps/${name}` : `packages/${name}`;
}

function workspaceRelativeFiles(workspace, files) {
  const root = `${workspaceRoot(workspace)}/`;
  return files.map((file) => (file.startsWith(root) ? file.slice(root.length) : file));
}

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
      args: [
        '--filter',
        target.workspace,
        'exec',
        'vitest',
        'run',
        ...workspaceRelativeFiles(target.workspace, target.files),
      ],
    };
  }

  return {
    kind,
    executable: 'pnpm',
    args: [
      '--filter',
      target.workspace,
      'exec',
      'vitest',
      'related',
      ...workspaceRelativeFiles(target.workspace, target.files),
    ],
  };
}

function buildLintCommands(plan) {
  const files = plan.lintFiles ?? [];
  const prettierFiles = files.filter((file) => /\.(?:ts|js|yml|yaml)$/.test(file));
  const eslintFiles = files.filter((file) => /\.(?:[cm]?js|[cm]?ts)$/.test(file));
  const commands = [];
  if (prettierFiles.length > 0) {
    commands.push({
      kind: 'lint',
      executable: 'pnpm',
      args: ['exec', 'prettier', '--check', ...prettierFiles],
    });
  }
  if (eslintFiles.length > 0) {
    commands.push({
      kind: 'lint',
      executable: 'pnpm',
      args: ['exec', 'eslint', ...eslintFiles],
    });
  }
  return commands;
}

/**
 * Convert an affected execution plan to explicit executable/argument tuples.
 * No command is interpolated into a shell string.
 */
export function buildExecutionCommands(plan, { includeBrowser = true } = {}) {
  const commands = buildLintCommands(plan);
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

  if (includeBrowser && plan.browser?.mode === 'targeted') {
    const tags = plan.browser.tags.join('|');
    if (!tags) throw new Error('targeted browser execution requires at least one ownership tag');
    commands.push({
      kind: 'browser',
      executable: 'pnpm',
      args: ['exec', 'playwright', 'test', '--grep', tags, '--project=chromium'],
    });
  } else if (includeBrowser && plan.browser?.mode === 'full') {
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
  const selectedKinds = options.kinds ? new Set(options.kinds) : null;
  const includeBrowser = !options.skipBrowser && (!selectedKinds || selectedKinds.has('browser'));
  const commands = buildExecutionCommands(plan, { includeBrowser }).filter(
    (command) =>
      (!options.skipBrowser || command.kind !== 'browser') &&
      (!selectedKinds || selectedKinds.has(command.kind)),
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
