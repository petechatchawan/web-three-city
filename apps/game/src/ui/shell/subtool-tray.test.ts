import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountSubToolTray, type TrayCategory } from './subtool-tray.js';

afterEach(() => document.body.replaceChildren());

describe('subtool tray', () => {
  it('mounts terrain category content with brush controls', () => {
    const tray = mountSubToolTray(document.body, { onSelectTool: vi.fn(), onBrush: vi.fn() });
    tray.open('terrain');
    const modes = Array.from(
      tray.element.querySelectorAll<HTMLButtonElement>('[data-tool-mode]'),
      (b) => b.dataset.toolMode,
    );
    expect(modes).toEqual(['raise', 'lower', 'flatten']);
    expect(tray.element.querySelectorAll<HTMLButtonElement>('[data-brush-size]').length).toBe(3);
  });

  it('renders a white-tray tool language with icon tool pills and a distinct brush segment group', () => {
    const tray = mountSubToolTray(document.body, { onSelectTool: vi.fn(), onBrush: vi.fn() });
    tray.open('terrain');
    expect(tray.element.classList.contains('city-subtool-tray')).toBe(true);
    for (const button of tray.element.querySelectorAll<HTMLButtonElement>('[data-tool-mode]')) {
      expect(button.classList.contains('city-tool-pill')).toBe(true);
      expect(button.querySelector('[data-city-icon]')).not.toBeNull();
      expect(button.querySelector('.city-tool-label')).not.toBeNull();
    }
    const brush = tray.element.querySelector('.city-brush-stepper');
    expect(brush?.classList.contains('city-segment-group')).toBe(true);
    for (const button of brush?.querySelectorAll<HTMLButtonElement>('[data-brush-size]') ?? []) {
      expect(button.classList.contains('city-segment')).toBe(true);
    }
  });

  it('marks the selected tool pill after a subtool click', () => {
    const tray = mountSubToolTray(document.body, { onSelectTool: vi.fn(), onBrush: vi.fn() });
    tray.open('zones');
    const residential = tray.element.querySelector<HTMLButtonElement>(
      '[data-tool-mode="zone-residential"]',
    )!;
    const commercial = tray.element.querySelector<HTMLButtonElement>(
      '[data-tool-mode="zone-commercial"]',
    )!;
    expect(residential.getAttribute('aria-pressed')).toBe('false');
    residential.click();
    expect(residential.getAttribute('aria-pressed')).toBe('true');
    commercial.click();
    expect(residential.getAttribute('aria-pressed')).toBe('false');
    expect(commercial.getAttribute('aria-pressed')).toBe('true');
  });

  it('emits selectTool for a subtool click and brush for a brush pill', () => {
    const onSelectTool = vi.fn();
    const onBrush = vi.fn();
    const tray = mountSubToolTray(document.body, { onSelectTool, onBrush });
    tray.open('terrain');
    tray.element.querySelector<HTMLButtonElement>('[data-tool-mode="raise"]')?.click();
    expect(onSelectTool).toHaveBeenCalledWith('raise');
    tray.element.querySelector<HTMLButtonElement>('[data-brush-size="3"]')?.click();
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
