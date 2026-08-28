import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ArchitectureProfile, DiscoveredPackage, PackageManifest } from '../model.js';

const PROFILE_BY_NAMESPACE: Readonly<Record<string, Exclude<ArchitectureProfile, 'repository-test'>>> = {
  systems: 'system',
  foundation: 'foundation',
  orchestration: 'orchestration',
  apps: 'application',
  testkit: 'test-only',
  tooling: 'repository-tooling',
};

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

function stripYamlValue(value: string): string {
  const withoutComment = value.replace(/\s+#.*$/, '').trim();
  if (
    (withoutComment.startsWith('"') && withoutComment.endsWith('"')) ||
    (withoutComment.startsWith("'") && withoutComment.endsWith("'"))
  ) {
    return withoutComment.slice(1, -1);
  }
  return withoutComment;
}

export function parseWorkspacePatterns(text: string): readonly string[] {
  const patterns: string[] = [];
  let inPackages = false;

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === 'packages:') {
      inPackages = true;
      continue;
    }
    if (!inPackages || line.length === 0 || line.startsWith('#')) continue;
    if (!line.startsWith('- ')) {
      if (!rawLine.startsWith(' ') && !rawLine.startsWith('\t')) inPackages = false;
      continue;
    }
    patterns.push(stripYamlValue(line.slice(2)));
  }

  return patterns;
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/gu, '\\$&')
    .replace(/\*\*/gu, '§§DOUBLE_STAR§§')
    .replace(/\*/gu, '[^/]+')
    .replace(/§§DOUBLE_STAR§§/gu, '.+');
  return new RegExp(`^${escaped}$`, 'u');
}

async function findPackageJsonDirectories(rootDir: string): Promise<readonly string[]> {
  const directories: string[] = [];
  async function visit(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((entry) => entry.isFile() && entry.name === 'package.json')) directories.push(directory);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'coverage') continue;
      await visit(path.join(directory, entry.name));
    }
  }
  await visit(rootDir);
  return directories;
}

export function classifyPackageRoot(relativeRoot: string): Exclude<ArchitectureProfile, 'repository-test'> | undefined {
  const [namespace] = toPosix(relativeRoot).split('/');
  return namespace === undefined ? undefined : PROFILE_BY_NAMESPACE[namespace];
}

export function expectedPackageName(relativeRoot: string): string | undefined {
  const [namespace, name, ...rest] = toPosix(relativeRoot).split('/');
  if (namespace === undefined || name === undefined || rest.length > 0) return undefined;
  switch (namespace) {
    case 'systems': return `@web-three-city/${name}`;
    case 'apps': return `@web-three-city/app-${name}`;
    case 'orchestration': return `@web-three-city/orchestration-${name}`;
    case 'foundation': return `@web-three-city/foundation-${name}`;
    case 'testkit': return `@web-three-city/testkit-${name}`;
    case 'tooling': return `@web-three-city/tooling-${name}`;
    default: return undefined;
  }
}

export function normalizeExportMap(value: unknown): Readonly<Record<string, string>> {
  if (typeof value === 'string') return { '.': value };
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, target] of Object.entries(value)) {
    if (!key.startsWith('.')) continue;
    if (typeof target === 'string') {
      result[key] = target;
      continue;
    }
    if (target !== null && typeof target === 'object' && !Array.isArray(target)) {
      for (const condition of ['types', 'import', 'default']) {
        const candidate = (target as Record<string, unknown>)[condition];
        if (typeof candidate === 'string') {
          result[key] = candidate;
          break;
        }
      }
    }
  }
  return result;
}

export async function discoverWorkspacePackages(rootDir: string): Promise<readonly DiscoveredPackage[]> {
  const workspaceFile = await readFile(path.join(rootDir, 'pnpm-workspace.yaml'), 'utf8');
  const patterns = parseWorkspacePatterns(workspaceFile).map(globToRegExp);
  const candidateDirectories = await findPackageJsonDirectories(rootDir);
  const packages: DiscoveredPackage[] = [];

  for (const directory of candidateDirectories) {
    const relativeRoot = toPosix(path.relative(rootDir, directory));
    if (relativeRoot === '' || !patterns.some((pattern) => pattern.test(relativeRoot))) continue;
    const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')) as PackageManifest;
    const profile = classifyPackageRoot(relativeRoot);
    const name = manifest.name ?? `<unnamed:${relativeRoot}>`;
    packages.push({
      name,
      root: path.resolve(directory),
      relativeRoot,
      profile: profile ?? 'repository-tooling',
      manifest,
      exportMap: normalizeExportMap(manifest.exports),
    });
  }

  return packages.sort((left, right) => left.relativeRoot.localeCompare(right.relativeRoot));
}
