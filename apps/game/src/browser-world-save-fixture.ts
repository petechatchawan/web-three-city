import { WORLD_SAVE_KEY } from './application/save-coordinator.js';

export function writeBrowserWorldSaveFixture(payload: unknown): void {
  localStorage.setItem(WORLD_SAVE_KEY, JSON.stringify(payload));
}
