import type { Locator, Page } from '@playwright/test';
import type { InteractionEvidence } from '../../apps/game/src/interaction-evidence.js';

export const GAME_URL = 'http://127.0.0.1:4174/';

export async function readEvidence(page: Page): Promise<InteractionEvidence> {
  return page.evaluate(() => {
    const evidence = window.__WEB_THREE_CITY_INTERACTION__;
    if (evidence === undefined) throw new Error('missing interaction evidence');
    return evidence;
  });
}

export async function dispatchTouchOn(
  target: Locator,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  id: number,
  x: number,
  y: number,
): Promise<void> {
  await target.dispatchEvent(type, {
    pointerId: id,
    pointerType: 'touch',
    clientX: x,
    clientY: y,
    isPrimary: id === 1,
    bubbles: true,
    cancelable: true,
  });
}

export async function dispatchCanvasTouch(
  page: Page,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  id: number,
  x: number,
  y: number,
): Promise<void> {
  await dispatchTouchOn(page.locator('#game-canvas'), type, id, x, y);
}
