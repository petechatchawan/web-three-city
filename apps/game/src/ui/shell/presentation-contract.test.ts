import { describe, expect, it } from 'vitest';
import css from '../city-ui.css?raw';

describe('city UI presentation contract', () => {
  it('uses explicit game-control variants and keeps the base button rule presentation-neutral', () => {
    expect(css).toContain('.city-icon-button');
    expect(css).toContain('.city-nav-item');
    expect(css).toContain('.city-segment');
    expect(css).toContain('.city-tool-pill');
    expect(css).toContain('.city-menu-tile');

    const baseButtonRule = css.match(/\.city-ui button\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    expect(baseButtonRule).not.toContain('background: var(--city-ui-surface)');
    expect(baseButtonRule).not.toContain('border-radius: 0.65rem');
  });
});
