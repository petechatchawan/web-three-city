import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);

async function readRepoText(path) {
  return readFile(new URL(path, rootUrl), 'utf8');
}

async function readRepoJson(path) {
  return JSON.parse(await readRepoText(path));
}

async function readWorkspaceManifests() {
  const manifests = [];
  for (const root of ['apps', 'packages']) {
    const rootDirectory = new URL(`${root}/`, rootUrl);
    const entries = await readdir(rootDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const path = `${root}/${entry.name}/package.json`;
      try {
        manifests.push({ path, packageJson: await readRepoJson(path) });
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
  }
  return manifests;
}

const rootPackageJson = await readRepoJson('package.json');

test('root exposes canonical fast-loop scripts', () => {
  assert.equal(rootPackageJson.scripts.format, 'prettier --write "**/*.{ts,js,yml,yaml}"');
  assert.equal(rootPackageJson.scripts['test:watch'], 'pnpm -r --if-present test:watch');
});

test('every Vitest workspace exposes watch mode and non-test workspaces do not get a fake test surface', async () => {
  const manifests = await readWorkspaceManifests();
  let vitestWorkspaceCount = 0;
  for (const { path, packageJson } of manifests) {
    const testScript = packageJson.scripts?.test;
    if (typeof testScript === 'string' && testScript.includes('vitest')) {
      vitestWorkspaceCount += 1;
      assert.equal(packageJson.scripts['test:watch'], 'vitest', path);
    }
  }
  assert.equal(vitestWorkspaceCount, 21);
  const terrainLab = manifests.find(
    ({ packageJson }) => packageJson.name === '@web-three-city/terrain-lab',
  );
  assert.ok(terrainLab);
  assert.equal(terrainLab.packageJson.scripts?.test, undefined);
  assert.equal(terrainLab.packageJson.scripts?.['test:watch'], undefined);
});

test('repository-wide tooling gate includes workflow contract tests', () => {
  assert.match(rootPackageJson.scripts['test:deployment'], /development-workflow\.test\.mjs/);
});

test('pre-commit setup is staged-only and excludes slow gates', async () => {
  const packageJson = await readRepoJson('package.json');
  const preCommit = await readRepoText('.husky/pre-commit');
  assert.equal(packageJson.scripts.prepare, 'husky');
  assert.equal(typeof packageJson.devDependencies.husky, 'string');
  assert.equal(typeof packageJson.devDependencies['lint-staged'], 'string');
  assert.equal(preCommit.trim(), 'pnpm exec lint-staged');
  const lintStaged = packageJson['lint-staged'];
  assert.deepEqual(lintStaged['*.{ts,js}'], ['prettier --write', 'eslint --fix']);
  assert.equal(lintStaged['*.{mjs,cjs}'], 'eslint --fix');
  assert.equal(lintStaged['*.{yml,yaml}'], 'prettier --write');
  const serializedPolicy = `${preCommit}\n${JSON.stringify(lintStaged)}`;
  assert.doesNotMatch(
    serializedPolicy,
    /typecheck|vitest|playwright|pnpm verify|eslint \.|pnpm lint/i,
  );
});

test('AGENTS defines actionable repository navigation and verification policy', async () => {
  const agents = await readRepoText('AGENTS.md');
  for (const heading of [
    '## Repository Map',
    '## How to Locate Code',
    '## Architecture Rules',
    '## Fast Verification',
    '## Verification Escalation Rules',
    '## Static Level 2 Verification Map',
    '## Branch Policy',
    '## Documentation and Exact-Head Evidence',
    '## Definition of Done',
    '## Forbidden Shortcuts',
  ]) {
    assert.ok(agents.includes(heading), heading);
  }
  assert.match(agents, /pnpm --filter @web-three-city\/<pkg> test/);
  assert.match(agents, /pnpm --filter @web-three-city\/<pkg> typecheck/);
  for (const level of ['Level 0', 'Level 1', 'Level 2', 'Level 3', 'Level 4']) {
    assert.ok(agents.includes(level), level);
  }
  assert.match(agents, /highest required level/i);
  assert.match(agents, /conservative verification map/i);
  assert.match(agents, /same PR/i);
  assert.match(agents, /exact-head/i);
  assert.match(agents, /pnpm verify.*not.*default|not.*default.*pnpm verify/is);
  assert.match(agents, /master.*always-releasable/is);
});

test('AGENTS requires targeted browser evidence without making Full Browser the default PR gate', async () => {
  const agents = await readRepoText('AGENTS.md');
  assert.match(agents, /browser-observable.*targeted.*Playwright/is);
  assert.match(agents, /Full Browser.*not.*default.*every PR/is);
  assert.match(agents, /release.*milestone.*shared browser infrastructure/is);
  assert.match(agents, /full-ci/i);
  assert.match(agents, /nightly/i);
});

test('AGENTS static Level 2 map contains every approved changed-owner row', async () => {
  const agents = await readRepoText('AGENTS.md');
  for (const owner of [
    'world-core',
    'terrain-core',
    'simulation-core',
    'zone-core',
    'building-core',
    'rci-core',
    'economy-core',
    'road-core',
    'water-core',
    'terrain-generator',
    'camera-input',
    'building-three',
    'road-three',
    'terrain-three',
    'water-three',
    'zone-three',
  ]) {
    assert.match(agents, new RegExp('\\\\|\\\\s*`' + owner + '`\\\\s*\\\\|'), owner);
  }
});

test('AGENTS makes the exact-head documentation exception normative', async () => {
  const agents = await readRepoText('AGENTS.md');
  assert.match(agents, /living.*documentation.*before.*exact-head/is);
  assert.match(agents, /PR body|PR comment|pull request body|pull request comment/i);
  assert.match(agents, /do not create.*commit.*run ID|do not.*commit.*CI.*metadata/is);
});

test('bug Issue Form captures system, symptom, expectation, actual behavior, and reproduction', async () => {
  const issueForm = await readRepoText('.github/ISSUE_TEMPLATE/bug_report.yml');
  assert.match(issueForm, /name:\s*Bug report/i);
  assert.match(issueForm, /type:\s*dropdown/);
  assert.match(issueForm, /id:\s*system/);
  for (const system of [
    'World',
    'Terrain',
    'Water',
    'Roads',
    'Zoning',
    'Buildings',
    'Simulation Time',
    'RCI Demand & Occupancy',
    'Economy',
    'Cross-system / Unknown',
  ]) {
    assert.ok(issueForm.includes(system), system);
  }
  for (const id of ['symptom', 'expected', 'actual', 'reproduction']) {
    assert.match(issueForm, new RegExp(`id:\\s*${id}`));
  }
  assert.match(issueForm, /required:\s*true/);
});

test('PR template delegates affected-consumer decisions to AGENTS and enforces same-PR docs', async () => {
  const template = await readRepoText('.github/pull_request_template.md');
  assert.match(template, /AGENTS\.md.*Verification Escalation Rules/is);
  assert.match(template, /Targeted package tests/i);
  assert.match(template, /Targeted package typecheck/i);
  assert.match(template, /Affected consumer verification/i);
  assert.match(template, /docs\/systems\/<system>\/README\.md/i);
  assert.match(template, /Behavior.*contracts.*unchanged|documentation update not required/is);
  assert.match(template, /exact.*SHA/i);
  assert.match(template, /debug|temporary/i);
});

test('PR template separates targeted browser evidence from Full Browser escalation', async () => {
  const template = await readRepoText('.github/pull_request_template.md');
  assert.match(template, /Targeted browser verification/i);
  assert.match(template, /Targeted browser tags:/i);
  assert.match(template, /Full Browser escalation decision/i);
  assert.match(template, /required.*not required/is);
});

test('development workflow documents master trunk and package-targeted iteration instead of develop integration', async () => {
  const workflow = await readRepoText('docs/development-workflow.md');
  assert.match(workflow, /master.*always-releasable.*trunk/is);
  assert.match(workflow, /short-lived.*branch.*pull request.*master/is);
  assert.match(workflow, /Verification Ladder/i);
  assert.match(workflow, /AGENTS\.md/);
  assert.match(workflow, /pnpm --filter @web-three-city\/<pkg> test/);
  assert.doesNotMatch(workflow, /develop is the active integration branch/i);
  assert.doesNotMatch(workflow, /target `develop`/i);
});

test('development workflow reserves Full Browser for explicit escalation', async () => {
  const workflow = await readRepoText('docs/development-workflow.md');
  assert.match(workflow, /browser-observable.*targeted.*Playwright/is);
  assert.match(workflow, /Targeted browser tags:\s*traffic building/i);
  assert.match(
    workflow,
    /`browser_build` produces the exact Game\/Terrain Lab preview artifact and Browser CI consumes that artifact/is,
  );
  assert.match(workflow, /Browser then enters targeted mode from the plan/i);
  assert.doesNotMatch(workflow, /Targeted mode:.*consumes the Lean artifacts/i);
  assert.match(workflow, /Full Browser.*not.*default.*every PR/is);
  assert.match(workflow, /release.*milestone.*shared browser infrastructure/is);
  assert.match(workflow, /nightly/i);
});

test('Development Workflow living handoff records targeted browser CI', async () => {
  const readme = await readRepoText('docs/systems/development-workflow/README.md');
  assert.match(readme, /affected-verification-plan\.json/i);
  assert.match(readme, /Browser CI.*targeted mode.*plan/is);
  assert.match(readme, /exact Game\/Terrain Lab artifact/is);
  assert.match(readme, /Full Browser is not the default gate for every PR/i);
});

test('Selective Verification vNext documents all-system and apps/game precision', async () => {
  const spec = await readRepoText(
    'docs/systems/development-workflow/specs/2026-08-23-selective-verification-vnext.md',
  );
  const handoff = await readRepoText(
    'docs/systems/development-workflow/verification/2026-08-23-selective-verification-vnext.md',
  );

  for (const tag of ['@terrain', '@water', '@road', '@zoning', '@building', '@rci', '@traffic', '@interaction']) {
    assert.match(spec, new RegExp(`\\${tag}`), tag);
  }
  assert.match(spec, /apps\/game\/\*\*.*must not map to every Browser tag/is);
  assert.match(spec, /traffic-transport-transaction.*none/is);
  assert.match(spec, /game-bootstrap.*Full Browser/is);
  assert.match(handoff, /deterministic-only core.*Browser none/is);
  assert.match(handoff, /unknown\/shared authority.*Full Browser/is);
});

test('system registry reports implemented RCI and the Development Workflow system', async () => {
  const registry = await readRepoText('docs/systems/README.md');
  assert.match(
    registry,
    /\[RCI Demand & Occupancy\]\(rci\/README\.md\).*Implemented.*`rci-core`.*`RciSaveV1`.*`WorldSaveV5`/i,
  );
  assert.match(
    registry,
    /\[Development Workflow\]\(development-workflow\/README\.md\).*Implemented/i,
  );
});
