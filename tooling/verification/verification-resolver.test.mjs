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

test('deterministic apps/game application changes do not request Browser', () => {
  for (const file of [
    'apps/game/src/traffic-transport-transaction.ts',
    'apps/game/src/traffic-road-reconciliation.ts',
    'apps/game/src/rci-building-reconciliation.ts',
  ]) {
    const plan = resolveVerificationPlan([file]);
    assert.deepEqual(plan.browserTags, [], file);
    assert.equal(plan.browserRequired, false, file);
    assert.equal(plan.fullBrowserRequired, false, file);
  }
});

test('bounded apps/game presentation changes select only their system tags', () => {
  const cases = [
    ['apps/game/src/traffic-presentation.ts', ['@traffic']],
    ['apps/game/src/terraform-water-projection.ts', ['@water']],
    ['apps/game/src/zone-building-presentation.ts', ['@building', '@zoning']],
  ];

  for (const [file, tags] of cases) {
    const plan = resolveVerificationPlan([file]);
    assert.deepEqual(plan.browserTags, tags, file);
    assert.equal(plan.browserRequired, true, file);
    assert.equal(plan.fullBrowserRequired, false, file);
  }
});

test('direct system ownership maps every Browser authority precisely', () => {
  const cases = [
    ['packages/terrain-three/src/TerrainMesh.ts', ['@terrain']],
    ['packages/water-three/src/WaterMesh.ts', ['@water']],
    ['packages/road-three/src/RoadMesh.ts', ['@road']],
    ['packages/zone-three/src/ZoneMesh.ts', ['@zoning']],
    ['packages/building-three/src/BuildingMesh.ts', ['@building']],
    ['packages/rci-core/src/rci.ts', ['@rci']],
    ['packages/traffic-three/src/TrafficMesh.ts', ['@traffic']],
    ['packages/camera-input/src/pointer.ts', ['@interaction']],
    ['packages/economy-core/src/economy.ts', []],
    ['packages/simulation-core/src/simulation.ts', []],
  ];

  for (const [file, tags] of cases) {
    const plan = resolveVerificationPlan([file]);
    assert.deepEqual(plan.browserTags, tags, file);
    assert.equal(plan.fullBrowserRequired, false, file);
    assert.equal(plan.browserRequired, tags.length > 0, file);
  }
});

test('unbounded apps/game composition fails closed to Full Browser', () => {
  const plan = resolveVerificationPlan(['apps/game/src/game-bootstrap.ts']);
  assert.equal(plan.risk, VerificationRisk.GRAPH_BLIND);
  assert.equal(plan.browserRequired, true);
  assert.equal(plan.fullBrowserRequired, true);
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
  assert.equal(plan.fullBrowserRequired, true);
});

test('empty input returns GRAPH_SAFE with no systems', () => {
  const plan = resolveVerificationPlan([]);
  assert.equal(plan.risk, VerificationRisk.GRAPH_SAFE);
  assert.deepEqual(plan.systems, []);
});
