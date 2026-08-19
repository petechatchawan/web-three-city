import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountSubToolTray, type TrayCategory } from './subtool-tray.js';

afterEach(() => document.body.replaceChildren());

describe('M6.4 on-demand Build picker', () => {
  it('opens at four build categories and reveals Terrain tools on demand', () => {
    const picker = mountSubToolTray(document.body, {
      onSelectTool: vi.fn(),
      onBrush: vi.fn(),
    });
    picker.open();
    expect(picker.element.dataset.testid).toBe('build-picker');
    expect(
      Array.from(
        picker.element.querySelectorAll<HTMLElement>('[data-build-category]'),
        (button) => button.dataset.buildCategory,
      ),
    ).toEqual(['terrain', 'roads', 'zones', 'buildings']);

    picker.element
      .querySelector<HTMLButtonElement>('[data-testid="build-category-terrain"]')!
      .click();
    expect(
      Array.from(
        picker.element.querySelectorAll<HTMLButtonElement>('[data-tool-mode]'),
        (button) => button.dataset.toolMode,
      ),
    ).toEqual(['raise', 'lower', 'flatten']);
    expect(picker.element.querySelectorAll<HTMLButtonElement>('[data-brush-size]').length).toBe(3);
  });

  it('emits one concrete tool then closes the picker without mutating domain values itself', () => {
    const onSelectTool = vi.fn();
    const onBrush = vi.fn();
    const onClose = vi.fn();
    const picker = mountSubToolTray(document.body, { onSelectTool, onBrush, onClose });
    picker.open('terrain');
    picker.element.querySelector<HTMLButtonElement>('[data-brush-size="3"]')!.click();
    expect(onBrush).toHaveBeenCalledWith(3);

    picker.element.querySelector<HTMLButtonElement>('[data-tool-mode="raise"]')!.click();
    expect(onSelectTool).toHaveBeenCalledWith('raise');
    expect(picker.element.hidden).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders Zones as one tool collection with every action reachable once', () => {
    const picker = mountSubToolTray(document.body, {
      onSelectTool: vi.fn(),
      onBrush: vi.fn(),
    });
    picker.open('zones');
    expect(
      Array.from(
        picker.element.querySelectorAll<HTMLButtonElement>('[data-tool-mode]'),
        (button) => button.dataset.toolMode,
      ),
    ).toEqual(['zone-residential', 'zone-commercial', 'zone-industrial', 'zone-remove']);
    expect(picker.element.querySelector('[data-brush-size]')).toBeNull();
  });

  it('retains every non-Navigate concrete tool exactly once across build categories', () => {
    const picker = mountSubToolTray(document.body, {
      onSelectTool: vi.fn(),
      onBrush: vi.fn(),
    });
    const seen: string[] = [];
    for (const category of Object.keys(picker.categories) as TrayCategory[]) {
      picker.open(category);
      for (const button of picker.element.querySelectorAll<HTMLButtonElement>('[data-tool-mode]')) {
        seen.push(button.dataset.toolMode!);
      }
    }
    expect(seen).toEqual([
      'raise',
      'lower',
      'flatten',
      'road-build',
      'road-build-collector',
      'road-build-arterial',
      'road-bulldoze',
      'zone-residential',
      'zone-commercial',
      'zone-industrial',
      'zone-remove',
      'building-bulldoze',
    ]);
    expect(new Set(seen).size).toBe(seen.length);
    picker.close();
    expect(picker.element.hidden).toBe(true);
  });
});
