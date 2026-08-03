// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { dispatchGameToolEvent, dispatchGameTransactionState } from './game-tool-events.js';
import { bindGameToolHud, zonePreviewStateLabel } from './game-tool-hud-binding.js';
import {
  initialGameToolPresentationState,
  reduceGameToolPresentation,
} from './game-tool-presentation.js';
import { isZoneToolMode, type GameToolMode } from './game-tool-mode.js';
import { messageForGameReason } from './game-reason-catalog.js';
import { renderGameUi } from './game-ui.js';

const ZONE_MODES = [
  'zone-residential',
  'zone-commercial',
  'zone-industrial',
  'zone-remove',
] as const satisfies readonly GameToolMode[];

describe('Zoning tool UI contracts', () => {
  it('includes all Zone modes in the application tool union', () => {
    expect(ZONE_MODES.every((mode) => isZoneToolMode(mode))).toBe(true);
    expect(isZoneToolMode('road-build')).toBe(false);
  });

  it('reduces immutable Zone interaction and committing states', () => {
    let state = initialGameToolPresentationState();
    state = reduceGameToolPresentation(state, {
      type: 'select-tool',
      mode: 'zone-commercial',
    });
    state = reduceGameToolPresentation(state, {
      type: 'zone-state',
      state: Object.freeze({
        mode: 'zone-commercial',
        strokeActive: true,
        previewValid: false,
        previewInvalidReason: 'zone:wet-cell',
        previewCellCount: 4,
      }),
      reason: 'zone:wet-cell',
      effectiveCellCount: 2,
      invalidCellCount: 2,
    });

    expect(state.mode).toBe('zone-commercial');
    expect(state.interaction).toEqual({
      kind: 'zone',
      state: {
        mode: 'zone-commercial',
        strokeActive: true,
        previewValid: false,
        previewInvalidReason: 'zone:wet-cell',
        previewCellCount: 4,
      },
      reason: 'zone:wet-cell',
      effectiveCellCount: 2,
      invalidCellCount: 2,
    });
    expect(Object.isFrozen(state)).toBe(true);
    expect(
      reduceGameToolPresentation(state, { type: 'set-committing', domain: 'zone' }).interaction,
    ).toEqual({ kind: 'committing', domain: 'zone' });
  });

  it('maps all new Zone and cross-domain reasons to product copy', () => {
    expect(messageForGameReason('terraform:zone-occupied')).toBe(
      'Remove the zone before changing this terrain',
    );
    expect(messageForGameReason('road:zone-occupied')).toBe(
      'Remove the zone before building a road here',
    );
    expect(messageForGameReason('road:zone-access-lost')).toBe(
      'This road is required by an existing zone',
    );
    expect(messageForGameReason('zone:wet-cell')).toBe('Zones cannot be painted on water');
    expect(messageForGameReason('zone:road-access-required')).toBe(
      'Zones must be within three cells of a road',
    );
  });

  it('renders four accessible Zone controls and authoritative R/C/I counts', () => {
    const root = document.createElement('div');
    const ui = renderGameUi(root);

    expect(ui.zoneResidentialButton.textContent).toBe('Residential');
    expect(ui.zoneCommercialButton.textContent).toBe('Commercial');
    expect(ui.zoneIndustrialButton.textContent).toBe('Industrial');
    expect(ui.zoneRemoveButton.textContent).toBe('Remove Zone');
    expect(ui.zoneResidentialButton.getAttribute('aria-pressed')).toBe('false');

    ui.setZoneCounts({ residential: 7, commercial: 3, industrial: 2, total: 12 });
    expect(root.querySelector('[data-testid="zone-residential-count"]')?.textContent).toBe('7');
    expect(root.querySelector('[data-testid="zone-commercial-count"]')?.textContent).toBe('3');
    expect(root.querySelector('[data-testid="zone-industrial-count"]')?.textContent).toBe('2');
  });

  it('renders Zone Preview metrics, reason, and Zone transaction copy through HUD events', () => {
    const root = document.createElement('div');
    const ui = renderGameUi(root);
    const controller = new AbortController();
    bindGameToolHud(root, ui.canvas, controller.signal);

    dispatchGameToolEvent(
      ui.canvas,
      Object.freeze({
        type: 'zone-state',
        state: Object.freeze({
          mode: 'zone-residential',
          strokeActive: true,
          previewValid: false,
          previewInvalidReason: 'zone:wet-cell',
          previewCellCount: 5,
        }),
        reason: 'zone:wet-cell',
        effectiveCellCount: 3,
        invalidCellCount: 2,
      }),
    );

    expect(zonePreviewStateLabel('zone-residential', false)).toBe('Invalid paint');
    expect(root.querySelector('[data-testid="zone-requested-count"]')?.textContent).toBe('5');
    expect(root.querySelector('[data-testid="zone-effective-count"]')?.textContent).toBe('3');
    expect(root.querySelector('[data-testid="zone-invalid-count"]')?.textContent).toBe('2');
    expect(root.querySelector('[data-testid="tool-context-message"]')?.textContent).toBe(
      'Zones cannot be painted on water',
    );

    const listener = vi.fn();
    ui.canvas.addEventListener('web-three-city:game-tool-presentation', listener);
    dispatchGameTransactionState(ui.canvas, 'committing', 'zone');
    expect(root.querySelector('[data-testid="tool-context-message"]')?.textContent).toBe(
      'Applying Zone change…',
    );
    expect(listener).toHaveBeenCalledOnce();
  });
});
