import type { ArchitectureViolation, DependencyEdge, DiscoveredPackage, QueryEdge, ResolvedImport } from '../model.js';

export const A4 = 'docs/architecture/PACKAGE-BOUNDARY-MODEL.md';

export function violation(
  ruleId: string,
  sourcePath: string,
  message: string,
  reference: string,
  extras: Partial<Pick<ArchitectureViolation, 'consumer' | 'target' | 'targetPath'>> = {},
): ArchitectureViolation {
  return { ruleId, sourcePath, message, reference, ...extras };
}
export function dependencyNames(manifest: DiscoveredPackage['manifest'], includeDev: boolean): Set<string> {
  return new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...(includeDev ? Object.keys(manifest.devDependencies ?? {}) : []),
  ]);
}
export function isTestSource(sourcePath: string): boolean {
  return /(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(sourcePath);
}
export function importSubpath(entry: ResolvedImport): string { return entry.targetSubpath ?? '<private>'; }
export function isCrossPackage(entry: ResolvedImport): boolean {
  return entry.targetPackage !== undefined && (entry.sourcePackage === undefined || entry.sourcePackage.name !== entry.targetPackage.name);
}
export function hasExport(target: DiscoveredPackage, subpath: string): boolean {
  return Object.prototype.hasOwnProperty.call(target.exportMap, subpath);
}
export function targetSurface(entry: ResolvedImport): 'read' | 'commands' | 'composition' | 'other-private' {
  const subpath = importSubpath(entry);
  if (subpath === '.') return 'read';
  if (subpath === './commands') return 'commands';
  if (subpath === './composition') return 'composition';
  return 'other-private';
}
export function buildEdges(entries: readonly ResolvedImport[]): readonly DependencyEdge[] {
  return entries.filter((entry) => isCrossPackage(entry) && entry.targetPackage !== undefined).map((entry) => ({
    consumer: entry.sourcePackage?.name ?? '<repository-tests>', provider: entry.targetPackage!.name,
    sourcePath: entry.sourcePath, specifier: entry.specifier, targetSubpath: importSubpath(entry),
    isTypeOnly: entry.isTypeOnly, sourceProfile: entry.sourceProfile, targetProfile: entry.targetPackage!.profile,
    resolutionKind: entry.resolutionKind,
  }));
}
export function buildQueryEdges(entries: readonly ResolvedImport[]): readonly QueryEdge[] {
  return entries.filter((entry) => isCrossPackage(entry) && entry.sourcePackage?.profile === 'system' && entry.targetPackage?.profile === 'system' && targetSurface(entry) === 'read').map((entry) => ({ consumer: entry.sourcePackage!.name, provider: entry.targetPackage!.name, sourcePath: entry.sourcePath }));
}
