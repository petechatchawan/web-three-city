import type { ArchitectureViolation, DiscoveredPackage, ResolvedImport } from '../model.js';
import { expectedPackageName } from '../workspace/discover-workspace.js';
import { A4, dependencyNames, isCrossPackage, isTestSource, violation } from './rule-support.js';

export function evaluatePackageRules(packages: readonly DiscoveredPackage[], imports: readonly ResolvedImport[]): readonly ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  for (const current of packages) {
    const expected = expectedPackageName(current.relativeRoot);
    if (expected === undefined) {
      violations.push(violation('ARCH-PKG-002', `${current.relativeRoot}/package.json`, `Workspace package is outside the approved ownership namespaces: ${current.relativeRoot}`, A4, { consumer: current.name }));
    } else if (expected !== current.name) {
      violations.push(violation('ARCH-PKG-001', `${current.relativeRoot}/package.json`, `Package name ${current.name} does not match ownership path; expected ${expected}.`, A4, { consumer: current.name }));
    }
  }

  for (const entry of imports) {
    if (!isCrossPackage(entry) || entry.targetPackage === undefined) continue;
    const sourcePackage = entry.sourcePackage;
    const targetPackage = entry.targetPackage;
    const consumer = sourcePackage?.name ?? '<repository-tests>';
    const target = targetPackage.name;
    if (sourcePackage !== undefined) {
      const declared = dependencyNames(sourcePackage.manifest, isTestSource(entry.sourcePath));
      if (!declared.has(target)) violations.push(violation('ARCH-DEP-001', entry.sourcePath, `${consumer} imports ${target} without an explicit manifest dependency.`, A4, { consumer, target }));
    }
    const productionSource = entry.sourceProfile === 'system' || entry.sourceProfile === 'foundation' || entry.sourceProfile === 'orchestration' || entry.sourceProfile === 'application';
    if (productionSource && (targetPackage.profile === 'test-only' || targetPackage.profile === 'repository-tooling')) {
      violations.push(violation('ARCH-DEP-002', entry.sourcePath, `Production package ${consumer} must not depend on ${targetPackage.profile} package ${target}.`, A4, { consumer, target }));
    }
  }
  return violations;
}
