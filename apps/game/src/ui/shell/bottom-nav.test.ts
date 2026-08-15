import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountBottomNav } from './bottom-nav.js';

afterEach(() => document.body.replaceChildren());

describe('M6.4 mobile bottom navigation', () => {
  it('renders exactly Build and City as persistent gameplay entries', () => {
    const nav = mountBottomNav(document.body, vi.fn());

    expect(
      Array.from(
        nav.element.querySelectorAll<HTMLElement>('[data-nav-category]'),
        (item) => item.dataset.navCategory,
      ),
    ).toEqual(['build', 'city']);
    expect(nav.element.textContent).toContain('Build');
    expect(nav.element.textContent).toContain('City');
    expect(nav.element.textContent).not.toContain('Terrain');
    expect(nav.element.textContent).not.toContain('Roads');
    expect(nav.element.textContent).not.toContain('Zones');
    expect(nav.element.textContent).not.toContain('Navigate');
  });

  it('toggles Build presentation without synthesizing a gameplay Navigate selection', () => {
    const onSelect = vi.fn();
    const nav = mountBottomNav(document.body, onSelect);
    const build = nav.element.querySelector<HTMLButtonElement>('[data-testid="nav-build"]')!;

    build.click();
    expect(onSelect).toHaveBeenLastCalledWith('build');
    expect(build.getAttribute('aria-pressed')).toBe('true');

    build.click();
    expect(onSelect).toHaveBeenLastCalledWith('build');
    expect(build.getAttribute('aria-pressed')).toBe('false');
    expect(onSelect).not.toHaveBeenCalledWith(null);
  });

  it('routes City independently and clears Build presentation state', () => {
    const onSelect = vi.fn();
    const nav = mountBottomNav(document.body, onSelect);
    const build = nav.element.querySelector<HTMLButtonElement>('[data-testid="nav-build"]')!;
    const city = nav.element.querySelector<HTMLButtonElement>('[data-testid="nav-city"]')!;

    build.click();
    city.click();
    expect(onSelect).toHaveBeenLastCalledWith('city');
    expect(build.getAttribute('aria-pressed')).toBe('false');
  });
});
