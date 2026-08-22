#!/usr/bin/env node

import { resolveVerificationPlan } from './verification/resolver.mjs';

/**
 * Preview CLI: answers "from these changed files, what verification is needed?"
 * Fail-safe: unknown/blind escalate upward. Does not change any files.
 */

function parseArgs(argv) {
  const files = [];
  for (const arg of argv) {
    if (arg === '--json') continue;
    files.push(arg);
  }
  return { files, json: argv.includes('--json') };
}

function formatPlan(plan) {
  const lines = [
    'Affected Systems:',
    ...(plan.systems.length === 0 ? ['  (none)'] : plan.systems.map((s) => `  - ${s}`)),
    '',
    `Authority: ${plan.authority ?? '(none)'}`,
    `Risk: ${plan.risk}`,
    ...(plan.reason ? [`Reason: ${plan.reason}`] : []),
    '',
    'Recommended Verification:',
    ...(plan.verification.length === 0 ? ['  (none)'] : plan.verification.map((v) => `  - ${v}`)),
    '',
    ...(plan.browserRequired
      ? ['Browser Required: YES', `Browser Tags: ${plan.browserTags.join(', ') || '(none specific)'}`]
      : ['Browser Required: NO']),
    `Full Browser Required: ${plan.fullBrowserRequired ? 'YES' : 'NO'}`,
    `Deployment/Topology Checks: ${plan.deploymentRequired ? 'YES' : 'NO'}`,
  ];
  return lines.join('\n');
}

function main() {
  const { files, json } = parseArgs(process.argv.slice(2));
  const plan = resolveVerificationPlan(files);
  if (json) {
    process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
  } else {
    process.stdout.write(formatPlan(plan) + '\n');
  }
}

main();
