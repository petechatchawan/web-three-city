import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ArchitecturePolicy, ArchitectureViolation, DependencyEdge, DiscoveredPackage, QueryEdge, ResolvedImport } from '../model.js';

export const A4 = 'docs/architecture/PACKAGE-BOUNDARY-MODEL.md';
export const A6 = 'docs/architecture/PUBLIC-EXPORT-AND-DEPENDENCY-RULES.md';

export function violation(ruleId: string, sourcePath: string, message: string, reference: string, extras: Partial<Pick<ArchitectureViolation, 'consumer' | 'target' | 'targetPath'>> = {}): ArchitectureViolation {
  return { ruleId, sourcePath, message, reference, ...extras };
}
export async function loadPolicy(rootDir: string): Promise<ArchitecturePolicy> {
  try {
    const parsed = JSON.parse(await readFile(path.join(rootDir, 'architecture.policy.json'), 'utf8')) as { approvedSystemReads?: ArchitecturePolicy['approvedSystemReads'] };
    return { approvedSystemReads: parsed.approvedSystemReads ?? [] };
  } catch {
    return { approvedSystemReads: [] };
  }
}
export function dependencyNames(manifest: DiscoveredPackage['manifest'], includeDev: boolean): Set<string> {
  return new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {}), ...Object.keys(manifest.optionalDependencies ?? {}), ...(includeDev ? Object.keys(manifest.devDependencies ?? {}) : [])]);
}
export function isTestSource(sourcePath: string): boolean {
  return /(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(sourcePath);
}
export function importSubpath(entry: ResolvedImport): string { return entry.targetSubpath ?? '<private>'; }
export function isCrossPackage(entry: ResolvedImport): boolean {
  return entry.targetPackage !== undefined && (entry.sourcePackage === undefined || entry.sourcePackage.name !== entry.targetPackage.name);
}
export function systemReadApproved(policy: ArchitecturePolicy, consumer: string, provider: string): boolean {
  return policy.approvedSystemReads.some((entry) => entry.consumer === consumer && entry.provider === provider && entry.reference.length > 0);
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
  return entries.filter((entry) => isCrossPackage(entry) && entry.targetPackage !== undefined).map((entry) => ({ consumer: entry.sourcePackage?.name ?? '<repository-tests>', provider: entry.targetPackage!.name, sourcePath: entry.sourcePath, specifier: entry.specifier, targetSubpath: importSubpath(entry), isTypeOnly: entry.isTypeOnly, sourceProfile: entry.sourceProfile, targetProfile: entry.targetPackage!.profile, resolutionKind: entry.resolutionKind }));
}
export function buildQueryEdges(entries: readonly ResolvedImport[]): readonly QueryEdge[] {
  return entries.filter((entry) => isCrossPackage(entry) && entry.sourcePackage?.profile === 'system' && entry.targetPackage?.profile === 'system' && targetSurface(entry) === 'read').map((entry) => ({ consumer: entry.sourcePackage!.name, provider: entry.targetPackage!.name, sourcePath: entry.sourcePath }));
}
export function queryGraph(edges: readonly QueryEdge[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const edge of edges) {
    const targets = graph.get(edge.consumer) ?? new Set<string>();
    targets.add(edge.provider);
    graph.set(edge.consumer, targets);
    if (!graph.has(edge.provider)) graph.set(edge.provider, new Set());
  }
  return graph;
}
