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
  const lines = [];
  lines.push('Affected Systems:');
  if (plan.systems.length === 0) lines.push('  (none)');
  else for (const s of plan.systems) lines.push(`  - ${s}`);
  lines.push('');
  lines.push(`Risk: ${plan.risk}`);
  if (plan.reason) lines.push(`Reason: ${plan.reason}`);
  lines.push('');
  lines.push('Recommended Verification:');
  if (plan.verification.length === 0) lines.push('  (none)');
  else for (const v of plan.verification) lines.push(`  - ${v}`);
  if (plan.browserRequired) {
    lines.push('');
    lines.push('Browser Required: YES');
    lines.push(`Browser Tags: ${plan.browserTags.join(', ') || '(none specific)'}`);
  } else {
    lines.push('');
    lines.push('Browser Required: NO');
  }
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
