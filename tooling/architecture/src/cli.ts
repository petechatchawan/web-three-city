import path from 'node:path';
import process from 'node:process';
import { analyzeArchitecture } from './index.js';
import { verifyRepositoryState } from './repository-state.js';

function printViolations(violations: Awaited<ReturnType<typeof analyzeArchitecture>>['violations']): void {
  for (const current of violations) console.error(`${current.ruleId} ${current.sourcePath}: ${current.message} [${current.reference}]`);
}

async function run(): Promise<void> {
  const [command = 'check', rootArg = '../..', ...rest] = process.argv.slice(2);
  const rootDir = path.resolve(process.cwd(), rootArg);

  if (command === 'state') {
    const expectHeadIndex = rest.indexOf('--expect-head');
    const expectHead = expectHeadIndex >= 0 ? rest[expectHeadIndex + 1] : undefined;
    const state = await verifyRepositoryState(rootDir, expectHead === undefined ? {} : { expectHead });
    console.log(JSON.stringify(state, null, 2));
    return;
  }

  const report = await analyzeArchitecture(rootDir);
  if (command === 'report') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (command !== 'check') throw new Error(`Unknown architecture command: ${command}`);
  if (report.violations.length > 0) {
    printViolations(report.violations);
    process.exitCode = 1;
    return;
  }
  console.log(`Architecture check passed: ${report.packages.length} packages, ${report.edges.length} dependency edges, ${report.queryEdges.length} system Query edges.`);
}

await run();
