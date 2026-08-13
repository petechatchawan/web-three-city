import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountSubToolTray, type TrayCategory } from './subtool-tray.js';

afterEach(() => document.body.replaceChildren());

describe('subtool tray', () => {
  it('mounts terrain category content with brush controls', () => {
    const tray = mountSubToolTray(document.body, { onSelectTool: vi.fn(), onBrush: vi.fn() });
    tray.open('terrain');
    const buttons = tray.element.querySelectorAll<HTMLButtonElement>('[data-tool-mode]');
    const modes = Array.from(buttons, (button) => button.dataset.toolMode);
    expect(modes).toEqual(['raise', 'lower', 'flatten']);
    for (const button of buttons) {
      expect(button.classList.contains('city-tool-pill')).toBe(true);
      expect(button.querySelector('[data-city-icon]')).not.toBeNull();
      expect(button.querySelector('.city-tool-label')).not.toBeNull();
    }
    const brush = tray.element.querySelector('.city-brush-stepper');
    expect(brush?.classList.contains('city-segment-group')).toBe(true);
    expect(tray.element.querySelectorAll<HTMLButtonElement>('[data-brush-size]').length).toBe(3);
  });

  it('emits selectTool for a subtool click and brush for a brush pill', () => {
    const onSelectTool = vi.fn();
    const onBrush = vi.fn();
    const tray = mountSubToolTray(document.body, { onSelectTool, onBrush });
    tray.open('terrain');
    const raise = tray.element.querySelector<HTMLButtonElement>('[data-tool-mode="raise"]')!;
    raise.click();
    expect(onSelectTool).toHaveBeenCalledWith('raise');
    expect(raise.getAttribute('aria-pressed')).toBe('true');
    const brush = tray.element.querySelector<HTMLButtonElement>('[data-brush-size="3"]')!;
    expect(brush.classList.contains('city-segment')).toBe(true);
    brush.click();
    expect(onBrush).toHaveBeenCalledWith(3);
  });

  it('hides content after close()', () => {
    const tray = mountSubToolTray(document.body, { onSelectTool: vi.fn(), onBrush: vi.fn() });
    tray.open('zones');
    expect(tray.element.hasAttribute('hidden')).toBe(false);
    tray.close();
    expect(tray.element.hasAttribute('hidden')).toBe(true);
  });

  it('reaches every non-navigate tool mode exactly once across all categories', () => {
    const tray = mountSubToolTray(document.body, { onSelectTool: vi.fn(), onBrush: vi.fn() });
    const seen: string[] = [];
    for (const category of Object.keys(tray.categories) as TrayCategory[]) {
      tray.open(category);
      for (const button of tray.element.querySelectorAll<HTMLButtonElement>('[data-tool-mode]'))
        seen.push(button.dataset.toolMode!);
    }
    expect(seen).toEqual([
      'raise',
      'lower',
      'flatten',
      'road-build',
      'road-bulldoze',
      'zone-residential',
      'zone-commercial',
      'zone-industrial',
      'zone-remove',
      'building-bulldoze',
    ]);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
