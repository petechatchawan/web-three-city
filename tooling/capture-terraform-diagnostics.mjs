import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const options = {
  cwd: process.cwd(),
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
};

const unit = spawnSync('pnpm', ['-r', '--if-present', 'test:coverage'], options);
const format = spawnSync('pnpm', ['format:check'], options);
const outputDirectory = 'packages/terrain-core/coverage';
mkdirSync(outputDirectory, { recursive: true });

const unitLog = `${unit.stdout ?? ''}${unit.stderr ?? ''}`;
const formatLog = `${format.stdout ?? ''}${format.stderr ?? ''}`;
writeFileSync(`${outputDirectory}/terraform-unit.log`, unitLog, 'utf8');
writeFileSync(`${outputDirectory}/terraform-format.log`, formatLog, 'utf8');
writeFileSync(
  `${outputDirectory}/terraform-diagnostic-status.json`,
  `${JSON.stringify(
    {
      unitExitCode: unit.status,
      formatExitCode: format.status,
      unitSignal: unit.signal,
      formatSignal: format.signal,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

process.stdout.write(unitLog);
process.exitCode = unit.status ?? 1;
