import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ArchitectureProfile, DiscoveredPackage, ResolvedImport, SourceImport } from '../model.js';

interface PathAlias { readonly pattern: string; readonly targets: readonly string[] }
interface AliasConfig { readonly baseUrl: string; readonly aliases: readonly PathAlias[] }

function toPosix(value: string): string { return value.split(path.sep).join('/'); }
function pathInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
function sourcePackageForPath(rootDir: string, sourcePath: string, packages: readonly DiscoveredPackage[]): DiscoveredPackage | undefined {
  const absolute = path.resolve(rootDir, sourcePath);
  return packages.filter((candidate) => pathInside(absolute, candidate.root)).sort((left, right) => right.root.length - left.root.length)[0];
}
function sourceProfileForPath(rootDir: string, sourcePath: string, sourcePackage: DiscoveredPackage | undefined): ArchitectureProfile {
  if (sourcePackage !== undefined) return sourcePackage.profile;
  const relative = toPosix(path.relative(rootDir, path.resolve(rootDir, sourcePath)));
  return relative.startsWith('tests/') ? 'repository-test' : 'repository-tooling';
}
function packageForAbsolutePath(absolutePath: string, packages: readonly DiscoveredPackage[]): DiscoveredPackage | undefined {
  return packages.filter((candidate) => pathInside(absolutePath, candidate.root)).sort((left, right) => right.root.length - left.root.length)[0];
}
function workspacePackageSpecifier(specifier: string, packages: readonly DiscoveredPackage[]): { package: DiscoveredPackage; subpath: string } | undefined {
  return packages.map((candidate) => {
    if (specifier === candidate.name) return { package: candidate, subpath: '.' };
    const prefix = `${candidate.name}/`;
    return specifier.startsWith(prefix) ? { package: candidate, subpath: `./${specifier.slice(prefix.length)}` } : undefined;
  }).filter((value): value is { package: DiscoveredPackage; subpath: string } => value !== undefined).sort((left, right) => right.package.name.length - left.package.name.length)[0];
}
function stripJsonComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
}
async function loadAliasConfig(rootDir: string): Promise<AliasConfig> {
  for (const fileName of ['tsconfig.json', 'tsconfig.base.json']) {
    try {
      const parsed = JSON.parse(stripJsonComments(await readFile(path.join(rootDir, fileName), 'utf8'))) as { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } };
      const compilerOptions = parsed.compilerOptions ?? {};
      return {
        baseUrl: path.resolve(rootDir, compilerOptions.baseUrl ?? '.'),
        aliases: Object.entries(compilerOptions.paths ?? {}).map(([pattern, targets]) => ({ pattern, targets })),
      };
    } catch {
      // Try the next conventional configuration file.
    }
  }
  return { baseUrl: rootDir, aliases: [] };
}
function matchAlias(pattern: string, specifier: string): string | undefined {
  const star = pattern.indexOf('*');
  if (star === -1) return pattern === specifier ? '' : undefined;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) return undefined;
  return specifier.slice(prefix.length, specifier.length - suffix.length);
}
function resolveAliasTarget(aliasConfig: AliasConfig, specifier: string): string | undefined {
  for (const alias of aliasConfig.aliases) {
    const wildcard = matchAlias(alias.pattern, specifier);
    if (wildcard === undefined) continue;
    const [target] = alias.targets;
    if (target === undefined) return undefined;
    return path.resolve(aliasConfig.baseUrl, target.replace('*', wildcard));
  }
  return undefined;
}

export async function resolveImports(rootDir: string, imports: readonly SourceImport[], packages: readonly DiscoveredPackage[]): Promise<readonly ResolvedImport[]> {
  const aliasConfig = await loadAliasConfig(rootDir);
  const result: ResolvedImport[] = [];
  for (const entry of imports) {
    const sourcePackage = sourcePackageForPath(rootDir, entry.sourcePath, packages);
    const sourceProfile = sourceProfileForPath(rootDir, entry.sourcePath, sourcePackage);
    const sourceAbsolutePath = path.resolve(rootDir, entry.sourcePath);
    const workspaceSpecifier = workspacePackageSpecifier(entry.specifier, packages);
    if (workspaceSpecifier !== undefined) {
      result.push({ ...entry, ...(sourcePackage === undefined ? {} : { sourcePackage }), sourceProfile, targetPackage: workspaceSpecifier.package, targetSubpath: workspaceSpecifier.subpath, resolutionKind: 'package' });
      continue;
    }
    if (entry.specifier.startsWith('.')) {
      const targetPath = path.resolve(path.dirname(sourceAbsolutePath), entry.specifier);
      const targetPackage = packageForAbsolutePath(targetPath, packages);
      result.push({ ...entry, ...(sourcePackage === undefined ? {} : { sourcePackage }), sourceProfile, ...(targetPackage === undefined ? {} : { targetPackage }), targetPath: toPosix(path.relative(rootDir, targetPath)), resolutionKind: 'relative' });
      continue;
    }
    const aliasTarget = resolveAliasTarget(aliasConfig, entry.specifier);
    if (aliasTarget !== undefined) {
      const targetPackage = packageForAbsolutePath(aliasTarget, packages);
      result.push({ ...entry, ...(sourcePackage === undefined ? {} : { sourcePackage }), sourceProfile, ...(targetPackage === undefined ? {} : { targetPackage }), targetPath: toPosix(path.relative(rootDir, aliasTarget)), resolutionKind: 'alias' });
      continue;
    }
    result.push({ ...entry, ...(sourcePackage === undefined ? {} : { sourcePackage }), sourceProfile, resolutionKind: entry.specifier.startsWith('@web-three-city/') ? 'unresolved' : 'third-party' });
  }
  return result;
}
