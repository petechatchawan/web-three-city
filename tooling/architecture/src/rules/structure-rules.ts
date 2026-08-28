import path from 'node:path';
import type { ArchitectureViolation, DependencyEdge, DiscoveredPackage, ResolvedImport } from '../model.js';
import { findDirectedCycles } from './graph.js';
import { A4, A5, A6, A11, graphFromEdges, isCrossPackage, pathContainsSegment, toPosix, violation } from './rule-support.js';

function resolveExportTarget(packageRoot: string, target: string): string { return path.resolve(packageRoot, target); }

export function evaluateStructureRules(rootDir: string, packages: readonly DiscoveredPackage[], imports: readonly ResolvedImport[], edges: readonly DependencyEdge[]): readonly ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  for (const entry of imports) {
    if (entry.sourcePackage?.profile === 'foundation' && entry.specifier === 'three') violations.push(violation('ARCH-TECH-001', entry.sourcePath, 'Foundation production source must not import Three.js.', A5, { consumer: entry.sourcePackage.name, target: 'three' }));
    const isDomain = pathContainsSegment(entry.sourcePath, 'domain');
    if (isDomain && entry.specifier === 'three') violations.push(violation('ARCH-TECH-001', entry.sourcePath, 'Domain source must remain presentation-technology independent and cannot import Three.js.', A5, { consumer: entry.sourcePackage?.name, target: 'three' }));
    if (isDomain && entry.targetPath !== undefined && ['application', 'contracts', 'ports', 'presentation', 'composition'].some((segment) => pathContainsSegment(entry.targetPath!, segment))) violations.push(violation('ARCH-STRUCT-001', entry.sourcePath, `Domain source imports an outer/internal layer: ${entry.specifier}`, A5, { consumer: entry.sourcePackage?.name, targetPath: entry.targetPath }));
    if (!isCrossPackage(entry) || entry.targetPackage === undefined) continue;
    if (entry.sourceProfile === 'test-only' && entry.targetPackage.profile === 'system') {
      if (entry.targetSubpath === './commands') violations.push(violation('ARCH-TEST-001', entry.sourcePath, `testkit package ${entry.sourcePackage?.name} has no privilege to import system commands from ${entry.targetPackage.name}.`, A6, { consumer: entry.sourcePackage?.name, target: entry.targetPackage.name }));
      else if (entry.targetSubpath === './composition') violations.push(violation('ARCH-TEST-002', entry.sourcePath, `testkit package ${entry.sourcePackage?.name} has no privilege to import system composition from ${entry.targetPackage.name}.`, A6, { consumer: entry.sourcePackage?.name, target: entry.targetPackage.name }));
    }
    if (entry.sourceProfile === 'repository-test' && (entry.resolutionKind === 'relative' || entry.resolutionKind === 'alias')) violations.push(violation('ARCH-TEST-003', entry.sourcePath, `Repository-level test reaches private implementation of ${entry.targetPackage.name}; external tests must use exports.`, A4, { consumer: '<repository-tests>', target: entry.targetPackage.name, targetPath: entry.targetPath }));
  }
  for (const current of packages) {
    for (const [subpath, exportedTarget] of Object.entries(current.exportMap)) {
      if (subpath === './composition') continue;
      const relativeExportTarget = toPosix(path.relative(rootDir, resolveExportTarget(current.root, exportedTarget)));
      for (const entry of imports) {
        if (entry.sourcePath !== relativeExportTarget) continue;
        if (entry.resolutionKind === 'relative' && entry.targetPath !== undefined && pathContainsSegment(entry.targetPath, 'ports')) violations.push(violation('ARCH-CONTRACT-001', entry.sourcePath, `Public surface ${subpath} of ${current.name} references internal port ${entry.targetPath}.`, A6, { consumer: current.name, targetPath: entry.targetPath }));
      }
    }
  }
  const productionEdges = edges.filter((edge) => edge.sourceProfile !== 'repository-test' && edge.sourceProfile !== 'repository-tooling');
  for (const cycle of findDirectedCycles(graphFromEdges(productionEdges))) violations.push(violation('ARCH-CYCLE-001', '<package-graph>', `Production package graph contains a cycle: ${cycle.join(' -> ')}`, A11));
  return violations;
}
