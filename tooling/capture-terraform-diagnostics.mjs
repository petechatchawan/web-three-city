import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const options = {
  cwd: process.cwd(),
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
};

const formattedFiles = [
  'apps/game/src/game-input.ts',
  'browser-tests/terraform.spec.ts',
  'browser-tests/terraform-visual-evidence.spec.ts',
  'packages/camera-input/test/dom-input-binding.test.ts',
  'packages/terrain-core/src/terraform-cell-line.ts',
  'packages/terrain-core/src/terraform-contracts.ts',
  'packages/terrain-core/src/terraform-plan.ts',
  'packages/terrain-core/test/terraform-brush.test.ts',
  'packages/terrain-core/test/terraform-cell-line.test.ts',
  'packages/terrain-core/test/terraform-plan.test.ts',
  'packages/terrain-core/test/terraform-undo-store.test.ts',
  'packages/terrain-three/test/terraform-preview-geometry.test.ts',
];

const unit = spawnSync('pnpm', ['-r', '--if-present', 'test:coverage'], options);
const format = spawnSync('pnpm', ['format:check'], options);
const prettier = spawnSync('pnpm', ['exec', 'prettier', '--write', ...formattedFiles], options);
const outputDirectory = 'packages/terrain-core/coverage';
mkdirSync(outputDirectory, { recursive: true });

const unitLog = `${unit.stdout ?? ''}${unit.stderr ?? ''}`;
const formatLog = `${format.stdout ?? ''}${format.stderr ?? ''}`;
const prettierLog = `${prettier.stdout ?? ''}${prettier.stderr ?? ''}`;
writeFileSync(`${outputDirectory}/terraform-unit.log`, unitLog, 'utf8');
writeFileSync(`${outputDirectory}/terraform-format.log`, formatLog, 'utf8');
writeFileSync(`${outputDirectory}/terraform-prettier.log`, prettierLog, 'utf8');
writeFileSync(
  `${outputDirectory}/terraform-diagnostic-status.json`,
  `${JSON.stringify(
    {
      unitExitCode: unit.status,
      formatExitCode: format.status,
      prettierExitCode: prettier.status,
      unitSignal: unit.signal,
      formatSignal: format.signal,
      prettierSignal: prettier.signal,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

for (const file of formattedFiles) {
  const destination = join(outputDirectory, 'formatted', file);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(file, destination);
}

process.stdout.write(unitLog);
process.exitCode = unit.status ?? 1;
