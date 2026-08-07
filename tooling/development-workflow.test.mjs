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
  assert.equal(vitestWorkspaceCount, 17);
  const terrainLab = manifests.find(({ packageJson }) => packageJson.name === '@web-three-city/terrain-lab');
  assert.ok(terrainLab);
  assert.equal(terrainLab.packageJson.scripts?.test, undefined);
  assert.equal(terrainLab.packageJson.scripts?.['test:watch'], undefined);
});

test('repository-wide tooling gate includes workflow contract tests', () => {
  assert.match(rootPackageJson.scripts['test:deployment'], /development-workflow\.test\.mjs/);
});
