import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountBottomNav } from './bottom-nav.js';

afterEach(() => document.body.replaceChildren());

describe('M6.3 Figma mobile bottom navigation', () => {
  it('renders exactly Terrain, Roads, Zones, Build, and City in persistent chrome', () => {
    const nav = mountBottomNav(document.body, vi.fn());

    expect(
      Array.from(
        nav.element.querySelectorAll<HTMLElement>('[data-nav-category]'),
        (item) => item.dataset.navCategory,
      ),
    ).toEqual(['terrain', 'roads', 'zones', 'buildings', 'city']);
    expect(nav.element.textContent).toContain('Terrain');
    expect(nav.element.textContent).toContain('Roads');
    expect(nav.element.textContent).toContain('Zones');
    expect(nav.element.textContent).toContain('Build');
    expect(nav.element.textContent).toContain('City');
    expect(nav.element.textContent).not.toContain('Navigate');
  });

  it('toggles an active build category back to implicit Navigate mode', () => {
    const onSelect = vi.fn();
    const nav = mountBottomNav(document.body, onSelect);
    const terrain = nav.element.querySelector<HTMLButtonElement>('[data-testid="nav-terrain"]')!;

    terrain.click();
    expect(onSelect).toHaveBeenLastCalledWith('terrain');
    expect(terrain.getAttribute('aria-pressed')).toBe('true');

    terrain.click();
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(terrain.getAttribute('aria-pressed')).toBe('false');
  });

  it('routes City independently from build-category selection', () => {
    const onSelect = vi.fn();
    const nav = mountBottomNav(document.body, onSelect);
    const city = nav.element.querySelector<HTMLButtonElement>('[data-testid="nav-city"]');

    expect(city).not.toBeNull();
    city?.click();
    expect(onSelect).toHaveBeenLastCalledWith('city');
    expect(nav.element.querySelector('[aria-pressed="true"]')).toBeNull();
  });
});
