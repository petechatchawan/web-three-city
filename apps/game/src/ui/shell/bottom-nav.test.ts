import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountBuildCategoryDock } from './build-category-dock.js';
import { mountPrimaryActions } from './primary-actions.js';

afterEach(() => document.body.replaceChildren());

describe('M6.2 mobile primary actions and Build category dock', () => {
  it('keeps only Navigate and Build in persistent bottom chrome', () => {
    const actions = mountPrimaryActions(document.body, {
      onNavigate: vi.fn(),
      onToggleBuild: vi.fn(),
    });

    const navigate = actions.element.querySelector(
      '[data-testid="primary-navigate"]',
    );
    const build = actions.element.querySelector<HTMLButtonElement>(
      '[data-testid="build-cta"]',
    );
    expect(navigate).not.toBeNull();
    expect(build).not.toBeNull();
    expect(build?.textContent).toContain('Build');
    expect(build?.getAttribute('aria-expanded')).toBe('false');
    expect(actions.element.querySelector('[data-build-category]')).toBeNull();
  });

  it('opens the conditional Build category dock without selecting a tool', () => {
    const onSelectCategory = vi.fn();
    const onClose = vi.fn();
    const dock = mountBuildCategoryDock(document.body, {
      onSelectCategory,
      onClose,
    });

    expect(dock.element.hidden).toBe(true);
    dock.open();
    expect(dock.element.hidden).toBe(false);
    expect(onSelectCategory).not.toHaveBeenCalled();
    expect(
      Array.from(
        dock.element.querySelectorAll<HTMLButtonElement>(
          '[data-build-category]',
        ),
        (button) => button.dataset.buildCategory,
      ),
    ).toEqual(['terrain', 'roads', 'zones', 'buildings']);
    expect(
      dock.element.querySelector('[data-testid="build-close"]'),
    ).not.toBeNull();
  });

  it('marks the selected Build category and keeps Close independent', () => {
    const onSelectCategory = vi.fn();
    const onClose = vi.fn();
    const dock = mountBuildCategoryDock(document.body, {
      onSelectCategory,
      onClose,
    });
    dock.open();
    dock.setActiveCategory('zones');

    const zones = dock.element.querySelector<HTMLButtonElement>(
      '[data-build-category="zones"]',
    );
    const terrain = dock.element.querySelector<HTMLButtonElement>(
      '[data-build-category="terrain"]',
    );
    expect(zones?.getAttribute('aria-pressed')).toBe('true');
    expect(terrain?.getAttribute('aria-pressed')).toBe('false');

    zones?.click();
    expect(onSelectCategory).toHaveBeenCalledWith('zones');
    const close = dock.element.querySelector<HTMLButtonElement>(
      '[data-testid="build-close"]',
    );
    close?.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
