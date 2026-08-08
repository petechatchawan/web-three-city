import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import test from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const importPattern = /(?:import\s+(?:[^'"()]*?\s+from\s+)?|export\s+[^'"()]*?\s+from\s+|import\s*\()\s*['"]([^'"]+)['"]/g;

async function exists(file) { try { await stat(file); return true; } catch { return false; } }
async function walk(dir, predicate = () => true) {
  if (!(await exists(dir))) return [];
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
}
async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
const importsOf = (text) => [...text.matchAll(importPattern)].map((m) => m[1]);
const normalize = (file) => file.split(path.sep).join('/');

async function workspacePackages(root) {
  const result = [];
  for (const top of ['packages', 'apps']) {
    const dir = path.join(root, top);
    if (!(await exists(dir))) continue;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(dir, entry.name, 'package.json');
      if (!(await exists(manifestPath))) continue;
      const manifest = await readJson(manifestPath);
      result.push({ name: manifest.name, dir: path.dirname(manifestPath), manifest });
    }
  }
  return result;
}

function findCycles(graph) {
  const found = new Map();
  const visit = (start, node, stack) => {
    for (const next of graph.get(node) ?? []) {
      if (next === start) {
        const cycle = [...stack, node];
        const rotations = cycle.map((_, i) => [...cycle.slice(i), ...cycle.slice(0, i)]);
        rotations.sort((a, b) => a.join('|').localeCompare(b.join('|')));
        const canonical = [...rotations[0], rotations[0][0]];
        found.set(canonical.join('>'), canonical);
      } else if (!stack.includes(next) && next !== node) {
        visit(start, next, [...stack, node]);
      }
    }
  };
  for (const node of [...graph.keys()].sort()) visit(node, node, []);
  return [...found.values()].sort((a, b) => a.join('|').localeCompare(b.join('|')));
}

async function readRepositoryGraph({ root = repoRoot } = {}) {
  root = path.resolve(root instanceof URL ? fileURLToPath(root) : root);
  const packages = await workspacePackages(root);
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const names = [...byName.keys()];
  const graph = new Map();
  const result = {
    undeclaredWorkspaceImports: [], unusedRuntimeWorkspaceDependencies: [], testOnlyRuntimeDependencies: [],
    deepProductionImports: [], cycles: [], packageToAppImports: [], coreLayerViolations: [],
  };
  for (const pkg of packages) {
    const runtimeDeps = { ...(pkg.manifest.dependencies ?? {}), ...(pkg.manifest.peerDependencies ?? {}) };
    graph.set(pkg.name, Object.keys(runtimeDeps).filter((name) => byName.has(name)).sort());
    const sourceFiles = await walk(path.join(pkg.dir, 'src'), (f) => /\.(?:ts|tsx|js|mjs)$/.test(f) && !/\.test\./.test(f));
    const testFiles = [...await walk(path.join(pkg.dir, 'src'), (f) => /\.test\./.test(f)), ...await walk(path.join(pkg.dir, 'test'), (f) => /\.(?:ts|tsx|js|mjs)$/.test(f))];
    const prodImports = new Set();
    const testImports = new Set();
    for (const file of sourceFiles) for (const specifier of importsOf(await readFile(file, 'utf8'))) prodImports.add(specifier);
    for (const file of testFiles) for (const specifier of importsOf(await readFile(file, 'utf8'))) testImports.add(specifier);
    for (const specifier of prodImports) {
      const target = names.find((name) => specifier === name || specifier.startsWith(`${name}/`));
      if (target && !runtimeDeps[target]) result.undeclaredWorkspaceImports.push(`${pkg.name} -> ${target}`);
      if (!target && specifier === 'fixture-missing') result.undeclaredWorkspaceImports.push('fixture-missing');
      if (target && specifier !== target) result.deepProductionImports.push(`${pkg.name} -> ${specifier}`);
      const targetPkg = target ? byName.get(target) : undefined;
      if (targetPkg && pkg.dir.includes(`${path.sep}packages${path.sep}`) && targetPkg.dir.includes(`${path.sep}apps${path.sep}`)) result.packageToAppImports.push(`${pkg.name} -> ${target}`);
      const isCore = pkg.name?.endsWith('-core') || pkg.name === '@web-three-city/terrain-generator';
      const targetIsPresentation = target?.endsWith('-three') === true;
      if (isCore && (specifier === 'three' || specifier.startsWith('three/') || targetIsPresentation || targetPkg?.dir.includes(`${path.sep}apps${path.sep}`))) result.coreLayerViolations.push(`${pkg.name} -> ${specifier}`);
    }
    for (const dep of Object.keys(pkg.manifest.dependencies ?? {})) {
      if (!byName.has(dep)) continue;
      const prodUses = [...prodImports].some((s) => s === dep || s.startsWith(`${dep}/`));
      const testUses = [...testImports].some((s) => s === dep || s.startsWith(`${dep}/`));
      if (!prodUses) result.unusedRuntimeWorkspaceDependencies.push(`${pkg.name} -> ${dep}`);
      if (!prodUses && testUses) result.testOnlyRuntimeDependencies.push(`${pkg.name} -> ${dep}`);
    }
  }
  result.cycles = findCycles(graph);
  for (const key of Object.keys(result)) if (Array.isArray(result[key])) result[key].sort((a, b) => String(a).localeCompare(String(b)));
  return result;
}

async function resolvedLib(configPath, seen = new Set()) {
  if (seen.has(configPath)) return [];
  seen.add(configPath);
  const config = await readJson(configPath);
  if (config.compilerOptions?.lib) return config.compilerOptions.lib;
  if (!config.extends) return [];
  let extended = config.extends;
  if (!extended.endsWith('.json')) extended += '.json';
  return resolvedLib(path.resolve(path.dirname(configPath), extended), seen);
}
async function readCoreTsConfigs({ root = repoRoot } = {}) {
  root = path.resolve(root instanceof URL ? fileURLToPath(root) : root);
  let files;
  if (root !== repoRoot) files = await walk(root, (f) => path.basename(f) === 'tsconfig.json');
  else {
    const packages = await workspacePackages(root);
    files = packages.filter((p) => p.name?.endsWith('-core') || p.name === '@web-three-city/terrain-generator').map((p) => path.join(p.dir, 'tsconfig.json'));
  }
  return Promise.all(files.map(async (file) => ({ path: normalize(path.relative(root, file)), includesDomLib: (await resolvedLib(file)).some((x) => /^DOM(?:\.|$)/i.test(x)) })));
}

async function readBrowserImports({ root = repoRoot } = {}) {
  root = path.resolve(root instanceof URL ? fileURLToPath(root) : root);
  const files = await walk(path.join(root, 'browser-tests'), (file) => /\.(?:ts|tsx|js|mjs)$/.test(file));
  const imports = [];
  for (const file of files) {
    for (const rawSpecifier of importsOf(await readFile(file, 'utf8'))) {
      const specifier = rawSpecifier.startsWith('.')
        ? normalize(path.relative(root, path.resolve(path.dirname(file), rawSpecifier)))
        : rawSpecifier;
      imports.push({
        path: normalize(path.relative(root, file)),
        specifier,
        isDirectSourceImport: /^(?:packages|apps)\/[^/]+\/src\//.test(specifier),
      });
    }
  }
  return imports.sort((a, b) => `${a.path}:${a.specifier}`.localeCompare(`${b.path}:${b.specifier}`));
}

const allowedBrowserSourceImportEdges = new Set([
  'browser-tests/helpers/domain-fixtures.ts -> packages/road-core/src/index.js',
  'browser-tests/helpers/domain-fixtures.ts -> packages/terrain-core/src/index.js',
  'browser-tests/helpers/domain-fixtures.ts -> packages/terrain-generator/src/index.js',
  'browser-tests/helpers/domain-fixtures.ts -> packages/water-core/src/index.js',
  'browser-tests/helpers/domain-fixtures.ts -> packages/world-core/src/index.js',
  'browser-tests/helpers/domain-fixtures.ts -> packages/zone-core/src/index.js',
  'browser-tests/helpers/domain-fixtures.ts -> apps/game/src/road-placement-environment.js',
  'browser-tests/helpers/domain-fixtures.ts -> apps/game/src/zone-placement-environment.js',
  'browser-tests/helpers/interaction.ts -> packages/camera-input/src/index.js',
  'browser-tests/helpers/interaction.ts -> packages/water-three/src/index.js',
  'browser-tests/helpers/interaction.ts -> apps/game/src/interaction-evidence.js',
  'browser-tests/terrain-lab.@terrain@water.spec.ts -> apps/terrain-lab/src/fixture-registry.js',
  'browser-tests/terrain-lab-globals.d.ts -> apps/terrain-lab/src/bootstrap.js',
]);

const fixtureRoot = (name) => path.join(repoRoot, 'tooling', 'architecture-fixtures', name);

test('production workspace graph is declared and acyclic', async () => {
  const graph = await readRepositoryGraph();
  assert.deepEqual(graph.undeclaredWorkspaceImports, []);
  assert.deepEqual(graph.deepProductionImports, []);
  assert.deepEqual(graph.cycles, []);
  assert.deepEqual(graph.packageToAppImports, []);
});
test('core source has no presentation, app, or browser imports', async () => assert.deepEqual((await readRepositoryGraph()).coreLayerViolations, []));
test('scanner detects adversarial graph fixtures', async () => {
  const graph = await readRepositoryGraph({ root: fixtureRoot('graph-violations') });
  assert.deepEqual(graph.undeclaredWorkspaceImports, ['fixture-missing']);
  assert.deepEqual(graph.deepProductionImports, ['fixture-core -> fixture-domain/src/internal.js']);
  assert.ok(graph.cycles.some((cycle) => cycle.join('>') === 'fixture-a>fixture-b>fixture-a'));
});
test('runtime manifest dependencies match production imports', async () => {
  const graph = await readRepositoryGraph();
  assert.deepEqual(graph.unusedRuntimeWorkspaceDependencies, []);
  assert.deepEqual(graph.testOnlyRuntimeDependencies, []);
});
test('core TypeScript configs do not provide DOM libraries', async () => {
  for (const config of await readCoreTsConfigs()) assert.equal(config.includesDomLib, false, config.path);
});
test('core DOM detector catches inherited DOM config', async () => {
  const configs = await readCoreTsConfigs({ root: fixtureRoot('dom-config') });
  assert.deepEqual(configs.filter((c) => c.includesDomLib).map((c) => c.path), ['fixture-core/tsconfig.json']);
});
test('browser specs do not construct fixtures through direct source imports', async () => {
  const imports = await readBrowserImports();
  assert.deepEqual(
    imports.filter(
      (entry) =>
        entry.isDirectSourceImport &&
        entry.path.startsWith('browser-tests/') &&
        !allowedBrowserSourceImportEdges.has(`${entry.path} -> ${entry.specifier}`),
    ),
    [],
  );
});
test('browser import scanner normalizes importer and target paths', async () => {
  const imports = await readBrowserImports({ root: fixtureRoot('browser-imports') });
  assert.deepEqual(imports, [
    {
      path: 'browser-tests/spec.ts',
      specifier: 'packages/world-core/src/index.js',
      isDirectSourceImport: true,
    },
  ]);
});
