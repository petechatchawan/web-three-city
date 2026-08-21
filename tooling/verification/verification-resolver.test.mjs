import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveVerificationPlan } from './resolver.mjs';
import { VerificationRisk } from './risk.mjs';

test('traffic-core change selects traffic-core and expands to traffic-three', () => {
  const plan = resolveVerificationPlan(['packages/traffic-core/src/Road.ts']);
  assert.ok(plan.systems.includes('traffic-core'), `systems=${plan.systems}`);
  // traffic-core has PARTIAL consumers including traffic-three
  assert.ok(plan.systems.includes('traffic-three'), `systems=${plan.systems}`);
  assert.equal(plan.risk, VerificationRisk.PARTIAL);
  assert.ok(plan.verification.some((v) => v.includes('traffic-core')), plan.verification.join(','));
  assert.equal(plan.browserRequired, false);
});

test('traffic-three change selects traffic-three only', () => {
  const plan = resolveVerificationPlan(['packages/traffic-three/src/TrafficMesh.ts']);
  assert.ok(plan.systems.includes('traffic-three'));
  assert.equal(plan.risk, VerificationRisk.GRAPH_SAFE);
  assert.ok(plan.verification.includes('traffic-three:test'));
});

test('vite config change escalates to GLOBAL', () => {
  const plan = resolveVerificationPlan(['vite.config.ts']);
  assert.equal(plan.risk, VerificationRisk.GLOBAL);
  assert.ok(plan.systems.includes('GLOBAL'), `systems=${plan.systems}`);
  assert.equal(plan.browserRequired, true);
  assert.ok(plan.verification.includes('verify'));
  assert.ok(plan.verification.includes('verify:full') || plan.verification.includes('browser'));
});

test('unknown runtime registry change escalates to GRAPH_BLIND', () => {
  const plan = resolveVerificationPlan(['apps/game/src/registry.ts']);
  assert.equal(plan.risk, VerificationRisk.GRAPH_BLIND);
  assert.ok(plan.systems.length > 0);
  assert.equal(plan.browserRequired, true);
});

test('multiple package changes produce merged verification plan', () => {
  const plan = resolveVerificationPlan([
    'packages/traffic-core/src/graph.ts',
    'packages/road-core/src/RoadNetwork.ts',
  ]);
  assert.ok(plan.systems.includes('traffic-core'));
  assert.ok(plan.systems.includes('road-core'));
  assert.ok(plan.systems.includes('traffic-three'));
  assert.ok(plan.systems.includes('road-three'));
  // risk is max of involved
  assert.equal(plan.risk, VerificationRisk.PARTIAL);
  assert.ok(plan.verification.includes('traffic-core:test'));
  assert.ok(plan.verification.includes('road-core:test'));
  // deduped
  assert.equal(new Set(plan.verification).size, plan.verification.length);
});

test('unknown file path escalates to GRAPH_BLIND (fail-safe)', () => {
  const plan = resolveVerificationPlan(['some/random/unknown-file.ts']);
  assert.equal(plan.risk, VerificationRisk.GRAPH_BLIND);
});

test('empty input returns GRAPH_SAFE with no systems', () => {
  const plan = resolveVerificationPlan([]);
  assert.equal(plan.risk, VerificationRisk.GRAPH_SAFE);
  assert.deepEqual(plan.systems, []);
});
