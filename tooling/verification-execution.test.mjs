import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAffectedExecutionPlan } from './verification/execution-plan.mjs';
import { resolveVerificationPlan } from './verification/resolver.mjs';

const trafficSource = 'packages/traffic-core/src/graph.ts';
const trafficBrowser = 'browser-tests/traffic-commute.@traffic@visual.spec.ts';

test('builds owner, consumer, typecheck, and targeted browser execution for a Traffic change', () => {
  const changedFiles = [trafficSource, trafficBrowser];
  const resolution = resolveVerificationPlan(changedFiles);

  const plan = buildAffectedExecutionPlan(resolution, changedFiles, {
    baseSha: 'base-sha',
    headSha: 'head-sha',
  });

  assert.deepEqual(plan.ownerTests, [
    {
      workspace: '@web-three-city/traffic-core',
      files: [trafficSource],
      mode: 'related',
    },
  ]);
  assert.ok(plan.consumerTests.some((target) => target.workspace === '@web-three-city/game'));
  assert.ok(plan.typechecks.includes('@web-three-city/traffic-core'));
  assert.ok(plan.typechecks.includes('@web-three-city/game'));
  assert.deepEqual(plan.browser, {
    mode: 'targeted',
    tags: ['@traffic'],
    fullBrowserRequired: false,
  });
  assert.deepEqual(plan.exactHead, { baseSha: 'base-sha', headSha: 'head-sha' });
});

test('runs a changed deterministic test directly without requesting browser evidence', () => {
  const changedFiles = ['apps/game/src/traffic-release-fixture.test.ts'];
  const resolution = resolveVerificationPlan(changedFiles);

  const plan = buildAffectedExecutionPlan(resolution, changedFiles, {
    baseSha: 'base-sha',
    headSha: 'head-sha',
  });

  assert.deepEqual(plan.ownerTests, [
    {
      workspace: '@web-three-city/game',
      files: changedFiles,
      mode: 'files',
    },
  ]);
  assert.deepEqual(plan.consumerTests, []);
  assert.deepEqual(plan.browser, {
    mode: 'none',
    tags: [],
    fullBrowserRequired: false,
  });
});

test('shared browser configuration selects Full Browser explicitly', () => {
  const changedFiles = ['playwright.config.ts'];
  const resolution = resolveVerificationPlan(changedFiles);

  const plan = buildAffectedExecutionPlan(resolution, changedFiles, {
    baseSha: 'base-sha',
    headSha: 'head-sha',
  });

  assert.equal(plan.browser.mode, 'full');
  assert.equal(plan.browser.fullBrowserRequired, true);
  assert.deepEqual(plan.browser.tags, []);
  assert.equal(plan.deploymentChecks, true);
});

test('builds targeted Browser plans for every bounded system authority', () => {
  const cases = [
    ['packages/terrain-three/src/TerrainMesh.ts', ['@terrain']],
    ['packages/water-three/src/WaterMesh.ts', ['@water']],
    ['packages/road-three/src/RoadMesh.ts', ['@road']],
    ['packages/zone-three/src/ZoneMesh.ts', ['@zoning']],
    ['packages/building-three/src/BuildingMesh.ts', ['@building']],
    ['packages/rci-core/src/rci.ts', ['@rci']],
    ['packages/traffic-three/src/TrafficMesh.ts', ['@traffic']],
    ['packages/camera-input/src/pointer.ts', ['@interaction']],
    ['apps/game/src/traffic-presentation.ts', ['@traffic']],
    ['apps/game/src/terraform-water-projection.ts', ['@water']],
  ];

  for (const [changedFile, tags] of cases) {
    const resolution = resolveVerificationPlan([changedFile]);
    const plan = buildAffectedExecutionPlan(resolution, [changedFile], {
      baseSha: 'base-sha',
      headSha: 'head-sha',
    });

    assert.deepEqual(plan.browser, {
      mode: 'targeted',
      tags,
      fullBrowserRequired: false,
    }, changedFile);
  }
});

test('builds a sorted targeted union for bounded multi-system presentation', () => {
  const changedFiles = ['apps/game/src/zone-building-presentation.ts'];
  const resolution = resolveVerificationPlan(changedFiles);
  const plan = buildAffectedExecutionPlan(resolution, changedFiles, {
    baseSha: 'base-sha',
    headSha: 'head-sha',
  });

  assert.deepEqual(plan.browser, {
    mode: 'targeted',
    tags: ['@building', '@zoning'],
    fullBrowserRequired: false,
  });
});

test('keeps deterministic and unbounded plans at opposite Browser boundaries', () => {
  const deterministicFiles = ['apps/game/src/traffic-transport-transaction.ts'];
  const deterministic = buildAffectedExecutionPlan(
    resolveVerificationPlan(deterministicFiles),
    deterministicFiles,
    { baseSha: 'base-sha', headSha: 'head-sha' },
  );
  assert.deepEqual(deterministic.browser, {
    mode: 'none',
    tags: [],
    fullBrowserRequired: false,
  });

  const unboundedFiles = ['apps/game/src/game-bootstrap.ts'];
  const unbounded = buildAffectedExecutionPlan(
    resolveVerificationPlan(unboundedFiles),
    unboundedFiles,
    { baseSha: 'base-sha', headSha: 'head-sha' },
  );
  assert.deepEqual(unbounded.browser, {
    mode: 'full',
    tags: [],
    fullBrowserRequired: true,
  });
});
