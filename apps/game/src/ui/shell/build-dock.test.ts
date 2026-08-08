import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountBuildDock } from './build-dock.js';

afterEach(() => document.body.replaceChildren());

describe('build dock', () => {
  it('reveals category tools and emits existing typed modes without Navigate side effects', () => {
    const selectTool = vi.fn();
    const dock = mountBuildDock(document.body, selectTool);
    dock.element.querySelector<HTMLButtonElement>('[data-build-category="roads"]')?.click();
    expect(dock.element.textContent).toContain('Build Road');
    expect(dock.element.textContent).toContain('Bulldoze Road');
    dock.element.querySelector<HTMLButtonElement>('[data-tool-mode="road-build"]')?.click();
    expect(selectTool).toHaveBeenCalledWith('road-build');
    expect(selectTool).not.toHaveBeenCalledWith('navigate');
  });
});
