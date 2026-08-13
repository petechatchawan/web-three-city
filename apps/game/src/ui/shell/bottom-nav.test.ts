import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountBottomNav, type NavCategory } from './bottom-nav.js';

const categories: NavCategory[] = ['navigate', 'terrain', 'roads', 'zones', 'buildings'];

afterEach(() => document.body.replaceChildren());

describe('bottom nav', () => {
  it('renders exactly the five rail tabs', () => {
    const nav = mountBottomNav(document.body, vi.fn());
    const buttons = nav.element.querySelectorAll<HTMLButtonElement>('[data-nav-category]');
    expect(Array.from(buttons, (b) => b.dataset.navCategory)).toEqual(categories);
    for (const button of buttons) {
      expect(button.classList.contains('city-nav-item')).toBe(true);
      expect(button.querySelector('[data-city-icon]')).not.toBeNull();
      expect(button.querySelector('.city-nav-label')).not.toBeNull();
    }
  });

  it('fires onSelect with the tapped category', () => {
    const onSelect = vi.fn();
    const nav = mountBottomNav(document.body, onSelect);
    nav.element.querySelector<HTMLButtonElement>('[data-nav-category="zones"]')?.click();
    expect(onSelect).toHaveBeenCalledWith('zones');
  });

  it('marks the active tab with aria-pressed', () => {
    const nav = mountBottomNav(document.body, vi.fn());
    nav.setActiveCategory('terrain');
    const terrain = nav.element.querySelector<HTMLButtonElement>('[data-nav-category="terrain"]');
    const navigate = nav.element.querySelector<HTMLButtonElement>('[data-nav-category="navigate"]');
    expect(terrain?.getAttribute('aria-pressed')).toBe('true');
    expect(navigate?.getAttribute('aria-pressed')).toBe('false');
  });
});
