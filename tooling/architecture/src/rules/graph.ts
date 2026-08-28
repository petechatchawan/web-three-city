export function findDirectedCycles(
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): readonly (readonly string[])[] {
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const seenCycleKeys = new Set<string>();

  function canonicalCycle(cycle: readonly string[]): string {
    const body = cycle.slice(0, -1);
    if (body.length === 0) return '';
    const rotations = body.map((_, index) => [...body.slice(index), ...body.slice(0, index)]);
    return rotations
      .map((rotation) => rotation.join('->'))
      .sort((left, right) => left.localeCompare(right))[0] ?? '';
  }

  function visit(node: string): void {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      const start = stack.lastIndexOf(node);
      if (start >= 0) {
        const cycle = [...stack.slice(start), node];
        const key = canonicalCycle(cycle);
        if (!seenCycleKeys.has(key)) {
          seenCycleKeys.add(key);
          cycles.push(cycle);
        }
      }
      return;
    }

    visiting.add(node);
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) visit(next);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of [...adjacency.keys()].sort()) visit(node);
  return cycles.sort((left, right) => left.join('->').localeCompare(right.join('->')));
}
