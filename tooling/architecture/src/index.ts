import path from 'node:path';
import { collectImportsFromDirectories } from './source/collect-imports.js';
import { resolveImports } from './resolution/resolve-import.js';
import { evaluateArchitectureRules } from './rules/evaluate-rules.js';
import { sortEdges, sortQueryEdges, sortViolations } from './report/sort-findings.js';
import { discoverWorkspacePackages } from './workspace/discover-workspace.js';
import type { ArchitectureReport } from './model.js';

export type { ArchitecturePolicy, ArchitectureProfile, ArchitectureReport, ArchitectureViolation, DependencyEdge, DiscoveredPackage, QueryEdge } from './model.js';

export async function analyzeArchitecture(rootDir: string): Promise<ArchitectureReport> {
  const absoluteRoot = path.resolve(rootDir);
  const packages = await discoverWorkspacePackages(absoluteRoot);
  const imports = await collectImportsFromDirectories(absoluteRoot, [...packages.map((current) => current.root), path.join(absoluteRoot, 'tests')]);
  const resolvedImports = await resolveImports(absoluteRoot, imports, packages);
  const evaluated = await evaluateArchitectureRules(absoluteRoot, packages, resolvedImports);
  return { packages, edges: sortEdges(evaluated.edges), queryEdges: sortQueryEdges(evaluated.queryEdges), violations: sortViolations(evaluated.violations) };
}
