import type { ArchitectureViolation, DependencyEdge, DiscoveredPackage, QueryEdge, ResolvedImport } from '../model.js';
import { buildEdges, buildQueryEdges } from './rule-support.js';

export async function evaluateArchitectureRules(
  _rootDir: string,
  _packages: readonly DiscoveredPackage[],
  imports: readonly ResolvedImport[],
): Promise<{ readonly edges: readonly DependencyEdge[]; readonly queryEdges: readonly QueryEdge[]; readonly violations: readonly ArchitectureViolation[] }> {
  return { edges: buildEdges(imports), queryEdges: buildQueryEdges(imports), violations: [] };
}
