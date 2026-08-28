import type { ArchitectureViolation, DependencyEdge, DiscoveredPackage, QueryEdge, ResolvedImport } from '../model.js';
import { evaluateExportRules } from './export-rules.js';
import { evaluateNamespaceRules } from './namespace-rules.js';
import { evaluatePackageRules } from './package-rules.js';
import { buildEdges, buildQueryEdges, loadPolicy } from './rule-support.js';
import { evaluateStructureRules } from './structure-rules.js';

export async function evaluateArchitectureRules(rootDir: string, packages: readonly DiscoveredPackage[], imports: readonly ResolvedImport[]): Promise<{ readonly edges: readonly DependencyEdge[]; readonly queryEdges: readonly QueryEdge[]; readonly violations: readonly ArchitectureViolation[] }> {
  const edges = buildEdges(imports);
  const queryEdges = buildQueryEdges(imports);
  const policy = await loadPolicy(rootDir);
  return { edges, queryEdges, violations: [...evaluatePackageRules(packages, imports), ...evaluateExportRules(imports), ...evaluateNamespaceRules(imports, queryEdges, policy), ...evaluateStructureRules(rootDir, packages, imports, edges)] };
}
