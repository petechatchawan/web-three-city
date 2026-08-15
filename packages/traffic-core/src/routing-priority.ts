import { compareTrafficId } from './contracts.js';

export interface RoutingPriorityEntry {
  readonly nodeId: string;
  readonly totalCostSeconds: number;
  readonly traversalCount: number;
  readonly incomingEdgeId: string;
}

export function compareRoutingPriority(
  first: RoutingPriorityEntry,
  second: RoutingPriorityEntry,
): number {
  if (first.totalCostSeconds !== second.totalCostSeconds) {
    return first.totalCostSeconds - second.totalCostSeconds;
  }
  if (first.traversalCount !== second.traversalCount) {
    return first.traversalCount - second.traversalCount;
  }
  const nodeOrder = compareTrafficId(first.nodeId, second.nodeId);
  if (nodeOrder !== 0) return nodeOrder;
  return compareTrafficId(first.incomingEdgeId, second.incomingEdgeId);
}

export class RoutingPriorityQueue {
  readonly #values: RoutingPriorityEntry[] = [];

  get size(): number {
    return this.#values.length;
  }

  push(value: RoutingPriorityEntry): void {
    this.#values.push(value);
    let index = this.#values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compareRoutingPriority(this.#values[parent]!, this.#values[index]!) <= 0) break;
      [this.#values[parent], this.#values[index]] = [this.#values[index]!, this.#values[parent]!];
      index = parent;
    }
  }

  pop(): RoutingPriorityEntry | null {
    if (this.#values.length === 0) return null;
    const first = this.#values[0]!;
    const last = this.#values.pop()!;
    if (this.#values.length > 0) {
      this.#values[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (
          left < this.#values.length &&
          compareRoutingPriority(this.#values[left]!, this.#values[smallest]!) < 0
        ) {
          smallest = left;
        }
        if (
          right < this.#values.length &&
          compareRoutingPriority(this.#values[right]!, this.#values[smallest]!) < 0
        ) {
          smallest = right;
        }
        if (smallest === index) break;
        [this.#values[index], this.#values[smallest]] = [
          this.#values[smallest]!,
          this.#values[index]!,
        ];
        index = smallest;
      }
    }
    return first;
  }
}
