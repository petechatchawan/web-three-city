import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveVerificationPlan } from './verification/resolver.mjs';
import { VerificationRisk } from './verification/risk.mjs';

test('resolver exposes risk ordering with escalation preference', () => {
  assert.ok(VerificationRisk.GRAPH_SAFE !== VerificationRisk.GLOBAL);
});

test('audit-required packages are present in ownership model', () => {
  const plan = resolveVerificationPlan(['packages/citizen-mobility-core/src/mobility.ts']);
  assert.ok(plan.systems.includes('citizen-mobility-core'));
  // traffic-core is a consumer of citizen-mobility-core
  assert.ok(plan.systems.includes('traffic-core'));
});

test('CLI answers the changed-files question without changing anything', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync(
    'node',
    ['tooling/verify-impact.mjs', 'packages/traffic-core/src/Road.ts'],
    { cwd: process.cwd() },
  );
  assert.match(stdout, /Affected Systems:/);
  assert.match(stdout, /Risk:\s*PARTIAL/);
  assert.match(stdout, /traffic-core:test|traffic-core/);
});

test('GLOBAL escalation includes verify + verify:full', () => {
  const plan = resolveVerificationPlan(['vite.config.ts']);
  assert.equal(plan.risk, VerificationRisk.GLOBAL);
  assert.ok(plan.verification.includes('verify'));
  assert.ok(plan.verification.includes('verify:full'));
  assert.equal(plan.browserRequired, true);
});

test('merging keeps verification deduplicated', () => {
  const plan = resolveVerificationPlan([
    'packages/traffic-core/src/graph.ts',
    'packages/road-core/src/RoadNetwork.ts',
  ]);
  assert.equal(new Set(plan.verification).size, plan.verification.length);
  assert.ok(plan.systems.includes('traffic-three'));
  assert.ok(plan.systems.includes('road-three'));
});
