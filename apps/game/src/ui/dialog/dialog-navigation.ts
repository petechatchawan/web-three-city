export interface PrimaryDialogRoute {
  readonly kind: 'system' | 'inspect';
  readonly key: string;
  readonly title: string;
  readonly live?: boolean;
}

export interface DialogNavigation {
  open(route: PrimaryDialogRoute): void;
  push(route: PrimaryDialogRoute): void;
  back(): PrimaryDialogRoute | null;
  close(): void;
  active(): PrimaryDialogRoute | null;
}

export function createDialogNavigation(): DialogNavigation {
  let routes: PrimaryDialogRoute[] = [];
  return Object.freeze({
    open(route: PrimaryDialogRoute): void {
      routes = [Object.freeze({ ...route })];
    },
    push(route: PrimaryDialogRoute): void {
      if (routes.length === 0) throw new Error('dialog-navigation:no-primary-route');
      routes = [...routes, Object.freeze({ ...route })];
    },
    back(): PrimaryDialogRoute | null {
      routes = routes.slice(0, -1);
      return routes.at(-1) ?? null;
    },
    close(): void {
      routes = [];
    },
    active(): PrimaryDialogRoute | null {
      return routes.at(-1) ?? null;
    },
  });
}
