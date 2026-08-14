import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountSubToolTray, type TrayCategory } from './subtool-tray.js';

afterEach(() => document.body.replaceChildren());

describe('M6.2 contextual tool dock', () => {
  it('mounts Terrain tools with a Terrain-only brush row', () => {
    const dock = mountSubToolTray(document.body, {
      onSelectTool: vi.fn(),
      onBrush: vi.fn(),
    });
    dock.open('terrain');
    expect(dock.element.classList.contains('city-contextual-tool-dock')).toBe(true);
    expect(dock.element.querySelector('.city-contextual-tool-dock-content')).not.toBeNull();
    const buttons = dock.element.querySelectorAll<HTMLButtonElement>('[data-tool-mode]');
    expect(Array.from(buttons, (button) => button.dataset.toolMode)).toEqual([
      'raise',
      'lower',
      'flatten',
    ]);
    expect(dock.element.querySelectorAll<HTMLButtonElement>('[data-brush-size]').length).toBe(3);
    expect(dock.element.querySelector('.city-tool-context')).toBeNull();
  });

  it('emits exact tool and brush callbacks without changing domain values', () => {
    const onSelectTool = vi.fn();
    const onBrush = vi.fn();
    const dock = mountSubToolTray(document.body, { onSelectTool, onBrush });
    dock.open('terrain');
    const raise = dock.element.querySelector<HTMLButtonElement>('[data-tool-mode="raise"]');
    raise?.click();
    expect(onSelectTool).toHaveBeenCalledWith('raise');
    expect(raise?.getAttribute('aria-pressed')).toBe('true');
    dock.element.querySelector<HTMLButtonElement>('[data-brush-size="3"]')?.click();
    expect(onBrush).toHaveBeenCalledWith(3);
  });

  it('renders Zones as one tool collection with every action reachable once', () => {
    const dock = mountSubToolTray(document.body, {
      onSelectTool: vi.fn(),
      onBrush: vi.fn(),
    });
    dock.open('zones');
    expect(
      Array.from(
        dock.element.querySelectorAll<HTMLButtonElement>('[data-tool-mode]'),
        (button) => button.dataset.toolMode,
      ),
    ).toEqual(['zone-residential', 'zone-commercial', 'zone-industrial', 'zone-remove']);
    expect(dock.element.querySelector('[data-brush-size]')).toBeNull();
  });

  it('reaches every non-Navigate tool exactly once and hides after close', () => {
    const dock = mountSubToolTray(document.body, {
      onSelectTool: vi.fn(),
      onBrush: vi.fn(),
    });
    const seen: string[] = [];
    for (const category of Object.keys(dock.categories) as TrayCategory[]) {
      dock.open(category);
      for (const button of dock.element.querySelectorAll<HTMLButtonElement>('[data-tool-mode]')) {
        seen.push(button.dataset.toolMode!);
      }
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
    dock.close();
    expect(dock.element.hidden).toBe(true);
  });
});
