import type { ArchitectureViolation, ResolvedImport } from '../model.js';
import { A4, hasExport, importSubpath, isCrossPackage, violation } from './rule-support.js';

export function evaluateExportRules(imports: readonly ResolvedImport[]): readonly ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  for (const entry of imports) {
    const sourcePackage = entry.sourcePackage;
    const targetPackage = entry.targetPackage;
    if (entry.resolutionKind === 'unresolved' && entry.specifier.startsWith('@web-three-city/')) {
      violations.push(violation('ARCH-EXPORT-001', entry.sourcePath, `Workspace-style import does not resolve to a discovered package: ${entry.specifier}`, A4, { consumer: sourcePackage?.name, target: entry.specifier }));
      continue;
    }
    if (!isCrossPackage(entry) || targetPackage === undefined) continue;
    const consumer = sourcePackage?.name ?? '<repository-tests>';
    const target = targetPackage.name;
    if (entry.resolutionKind === 'package') {
      const subpath = importSubpath(entry);
      if (!hasExport(targetPackage, subpath)) violations.push(violation('ARCH-EXPORT-001', entry.sourcePath, `Import ${entry.specifier} reaches non-exported subpath ${subpath} of ${target}.`, A4, { consumer, target }));
    } else if (entry.resolutionKind === 'relative') {
      violations.push(violation('ARCH-EXPORT-002', entry.sourcePath, `Relative import reaches across package boundary into ${target}.`, A4, { consumer, target, targetPath: entry.targetPath }));
    } else if (entry.resolutionKind === 'alias') {
      violations.push(violation('ARCH-EXPORT-003', entry.sourcePath, `Path alias reaches across package boundary into ${target}; use an exported package surface.`, A4, { consumer, target, targetPath: entry.targetPath }));
    }
  }
  return violations;
}
