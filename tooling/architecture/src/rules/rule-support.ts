import type { DependencyEdge, QueryEdge, ResolvedImport } from '../model.js';

export function importSubpath(entry: ResolvedImport): string { return entry.targetSubpath ?? '<private>'; }
export function isCrossPackage(entry: ResolvedImport): boolean {
  return entry.targetPackage !== undefined && (entry.sourcePackage === undefined || entry.sourcePackage.name !== entry.targetPackage.name);
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
