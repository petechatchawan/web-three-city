export interface InformationViewAdapter {
  readonly key: string;
  readonly title: string;
  readonly legend: string;
  activate(): void;
  deactivate(): void;
}

export interface InformationViewRegistry {
  activate(key: string): void;
  replace(key: string): void;
  deactivate(): void;
  projection(): Readonly<{ key: string; title: string; legend: string }> | null;
  entries(): ReadonlyArray<Readonly<{ key: string; title: string }>>;
}

export function createInformationViewRegistry(
  adapters: readonly InformationViewAdapter[],
): InformationViewRegistry {
  const byKey = new Map(adapters.map((adapter) => [adapter.key, adapter]));
  if (byKey.size !== adapters.length) throw new Error('information-views:duplicate-key');
  let active: InformationViewAdapter | null = null;
  const activate = (key: string): void => {
    const next = byKey.get(key);
    if (next === undefined) throw new Error('information-views:unknown-key');
    if (active?.key === key) return;
    active?.deactivate();
    next.activate();
    active = next;
  };
  return Object.freeze({
    activate,
    replace: activate,
    deactivate(): void {
      if (active === null) return;
      active.deactivate();
      active = null;
    },
    projection() {
      return active === null
        ? null
        : Object.freeze({ key: active.key, title: active.title, legend: active.legend });
    },
    entries() {
      return Object.freeze(adapters.map(({ key, title }) => Object.freeze({ key, title })));
    },
  });
}
