import path from 'node:path';
import process from 'node:process';
import { analyzeArchitecture } from './index.js';

async function run(): Promise<void> {
  const [command = 'check', rootArg = '../..'] = process.argv.slice(2);
  const rootDir = path.resolve(process.cwd(), rootArg);
  const report = await analyzeArchitecture(rootDir);
  if (command === 'report') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (command !== 'check') throw new Error(`Unknown architecture command: ${command}`);
  if (report.violations.length > 0) {
    for (const current of report.violations) console.error(`${current.ruleId} ${current.sourcePath}: ${current.message} [${current.reference}]`);
    process.exitCode = 1;
    return;
  }
  console.log(`Architecture check passed: ${report.packages.length} packages, ${report.edges.length} dependency edges, ${report.queryEdges.length} system Query edges.`);
}

await run();
