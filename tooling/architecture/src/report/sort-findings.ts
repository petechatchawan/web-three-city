import type { ArchitectureViolation, DependencyEdge, QueryEdge } from '../model.js';

export function sortViolations(violations: readonly ArchitectureViolation[]): readonly ArchitectureViolation[] {
  return [...violations].sort((left, right) => `${left.ruleId}\u0000${left.sourcePath}\u0000${left.consumer ?? ''}\u0000${left.target ?? ''}\u0000${left.message}`.localeCompare(`${right.ruleId}\u0000${right.sourcePath}\u0000${right.consumer ?? ''}\u0000${right.target ?? ''}\u0000${right.message}`));
}
export function sortEdges(edges: readonly DependencyEdge[]): readonly DependencyEdge[] {
  return [...edges].sort((left, right) => `${left.consumer}\u0000${left.provider}\u0000${left.sourcePath}\u0000${left.specifier}`.localeCompare(`${right.consumer}\u0000${right.provider}\u0000${right.sourcePath}\u0000${right.specifier}`));
}
export function sortQueryEdges(edges: readonly QueryEdge[]): readonly QueryEdge[] {
  return [...edges].sort((left, right) => `${left.consumer}\u0000${left.provider}\u0000${left.sourcePath}`.localeCompare(`${right.consumer}\u0000${right.provider}\u0000${right.sourcePath}`));
}
