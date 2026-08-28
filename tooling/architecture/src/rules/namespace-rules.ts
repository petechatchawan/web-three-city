import type { ArchitecturePolicy, ArchitectureViolation, QueryEdge, ResolvedImport } from '../model.js';
import { findDirectedCycles } from './graph.js';
import { A6, isCrossPackage, queryGraph, systemReadApproved, targetSurface, violation } from './rule-support.js';

export function evaluateNamespaceRules(imports: readonly ResolvedImport[], queryEdges: readonly QueryEdge[], policy: ArchitecturePolicy): readonly ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  for (const entry of imports) {
    if (!isCrossPackage(entry) || entry.targetPackage === undefined) continue;
    const sourcePackage = entry.sourcePackage;
    const targetPackage = entry.targetPackage;
    const consumer = sourcePackage?.name ?? '<repository-tests>';
    const target = targetPackage.name;
    const surface = targetSurface(entry);

    if (entry.sourceProfile === 'foundation' && targetPackage.profile !== 'foundation') violations.push(violation('ARCH-FOUND-001', entry.sourcePath, `Foundation package ${consumer} has an upward dependency on ${target}.`, A6, { consumer, target }));
    if (entry.sourceProfile === 'system' && (targetPackage.profile === 'application' || targetPackage.profile === 'orchestration')) violations.push(violation('ARCH-SYS-005', entry.sourcePath, `System package ${consumer} cannot depend upward on ${targetPackage.profile} package ${target}.`, A6, { consumer, target }));
    if (entry.sourceProfile === 'orchestration' && targetPackage.profile === 'application') violations.push(violation('ARCH-ORCH-002', entry.sourcePath, `Orchestration package ${consumer} cannot depend on application package ${target}.`, A6, { consumer, target }));
    if (entry.sourceProfile === 'orchestration' && targetPackage.profile === 'orchestration') violations.push(violation('ARCH-ORCH-003', entry.sourcePath, `Orchestration-to-orchestration dependency ${consumer} -> ${target} is forbidden by default.`, A6, { consumer, target }));
    if (entry.sourceProfile === 'application' && targetPackage.profile === 'application') violations.push(violation('ARCH-APP-001', entry.sourcePath, `Application-to-application dependency ${consumer} -> ${target} is forbidden by default.`, A6, { consumer, target }));
    if (targetPackage.profile !== 'system') continue;

    if (entry.sourceProfile === 'system') {
      if (surface === 'commands') violations.push(violation('ARCH-SYS-001', entry.sourcePath, `Production system ${consumer} cannot import another system command surface ${target}.`, A6, { consumer, target }));
      else if (surface === 'composition') violations.push(violation('ARCH-SYS-002', entry.sourcePath, `Production system ${consumer} cannot import another system composition surface ${target}.`, A6, { consumer, target }));
      else if (surface === 'read' && !systemReadApproved(policy, consumer, target)) violations.push(violation('ARCH-SYS-003', entry.sourcePath, `Direct system read ${consumer} -> ${target} requires an approved read exception.`, A6, { consumer, target }));
    } else if (entry.sourceProfile === 'orchestration' && surface === 'composition') {
      violations.push(violation('ARCH-ORCH-001', entry.sourcePath, `Orchestration package ${consumer} cannot import system composition surface ${target}.`, A6, { consumer, target }));
    }
  }
  for (const cycle of findDirectedCycles(queryGraph(queryEdges))) violations.push(violation('ARCH-SYS-004', '<system-query-graph>', `System Query graph contains a cycle: ${cycle.join(' -> ')}`, A6));
  return violations;
}
