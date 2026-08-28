import type { ArchitectureEdge, ArchitectureViolation, WorkspacePackage } from '../model';

function violation(ruleId: string, source: string, message: string, reference: string, target?: string): ArchitectureViolation {
  return { ruleId, source, message, reference, ...(target ? { target } : {}) };
}

function findCycle(nodes: readonly string[], edges: readonly ArchitectureEdge[]): string[] | undefined {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node, []);
  for (const edge of edges) {
    const list = adjacency.get(edge.from);
    if (list && adjacency.has(edge.to) && !list.includes(edge.to)) list.push(edge.to);
  }
  for (const list of adjacency.values()) list.sort();

  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const visit = (node: string): string[] | undefined => {
    state.set(node, 1);
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const nextState = state.get(next) ?? 0;
      if (nextState === 0) {
        const cycle = visit(next);
        if (cycle) return cycle;
      } else if (nextState === 1) {
        const start = stack.indexOf(next);
        return [...stack.slice(start), next];
      }
    }
    stack.pop();
    state.set(node, 2);
    return undefined;
  };

  for (const node of [...nodes].sort()) {
    if ((state.get(node) ?? 0) === 0) {
      const cycle = visit(node);
      if (cycle) return cycle;
    }
  }
  return undefined;
}

export function checkGraphRules(packages: readonly WorkspacePackage[], edges: readonly ArchitectureEdge[]): ArchitectureViolation[] {
  const production = edges.filter((edge) => edge.kind === 'production');
  const violations: ArchitectureViolation[] = [];

  const systems = packages.filter((pkg) => pkg.profile === 'system').map((pkg) => pkg.name);
  const systemEdges = production.filter((edge) => systems.includes(edge.from) && systems.includes(edge.to) && edge.surface === '.');
  const systemCycle = findCycle(systems, systemEdges);
  if (systemCycle) {
    violations.push(violation('ARCH-SYS-004', systemCycle[0] ?? 'system-query-graph', `Production system Query graph contains a cycle: ${systemCycle.join(' -> ')}`, 'A6 § Direct Query Graph'));
  }

  const foundation = packages.filter((pkg) => pkg.profile === 'foundation').map((pkg) => pkg.name);
  const foundationCycle = findCycle(foundation, production.filter((edge) => foundation.includes(edge.from) && foundation.includes(edge.to)));
  if (foundationCycle) {
    violations.push(violation('ARCH-FOUNDATION-002', foundationCycle[0] ?? 'foundation-graph', `Foundation dependency graph contains a cycle: ${foundationCycle.join(' -> ')}`, 'A8 § Foundation Dependency Direction'));
  }

  for (const profile of ['orchestration', 'testkit', 'tooling'] as const) {
    const names = packages.filter((pkg) => pkg.profile === profile).map((pkg) => pkg.name);
    const cycle = findCycle(names, production.filter((edge) => names.includes(edge.from) && names.includes(edge.to)));
    if (cycle) {
      violations.push(violation('ARCH-GRAPH-001', cycle[0] ?? `${profile}-graph`, `${profile} dependency graph contains a cycle: ${cycle.join(' -> ')}`, 'A6 § Same-Layer Dependencies'));
    }
  }

  return violations;
}
