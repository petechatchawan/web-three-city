export interface TransitionToken {
  readonly id: number;
}

export interface TransitionGuard {
  begin(): TransitionToken | undefined;
  finish(token: TransitionToken): void;
  cancel(): void;
  isCurrent(token: TransitionToken): boolean;
  isPending(): boolean;
  dispose(): void;
}

export function createTransitionGuard(): TransitionGuard {
  let nextId = 1;
  let current: TransitionToken | undefined;
  let disposed = false;

  return Object.freeze({
    begin(): TransitionToken | undefined {
      if (disposed || current !== undefined) return undefined;
      current = Object.freeze({ id: nextId++ });
      return current;
    },
    finish(token: TransitionToken): void {
      if (current?.id === token.id) current = undefined;
    },
    cancel(): void {
      current = undefined;
    },
    isCurrent(token: TransitionToken): boolean {
      return !disposed && current?.id === token.id;
    },
    isPending(): boolean {
      return !disposed && current !== undefined;
    },
    dispose(): void {
      disposed = true;
      current = undefined;
    },
  });
}
