import { WORLD_SAVE_KEY } from './application/save-coordinator.js';

let restorePendingFixture: (() => void) | null = null;

export function writeBrowserWorldSaveFixture(payload: unknown): void {
  restorePendingFixture?.();
  const serialized = JSON.stringify(payload);
  const storagePrototype = Object.getPrototypeOf(localStorage) as Storage;
  const originalGetItem = storagePrototype.getItem;
  let restored = false;

  const restore = (): void => {
    if (restored) return;
    restored = true;
    storagePrototype.getItem = originalGetItem;
    if (restorePendingFixture === restore) restorePendingFixture = null;
  };

  storagePrototype.getItem = function (this: Storage, key: string): string | null {
    if (this === localStorage && key === WORLD_SAVE_KEY) {
      restore();
      return serialized;
    }
    return originalGetItem.call(this, key);
  };
  restorePendingFixture = restore;
}
