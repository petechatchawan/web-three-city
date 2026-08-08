import { describe, expect, it } from 'vitest';
import { resolveCityUiLayout } from './responsive.js';

describe('resolveCityUiLayout', () => {
  it.each([
    [{ width: 844, height: 390 }, 'landscape-compact'],
    [{ width: 932, height: 430 }, 'landscape-compact'],
    [{ width: 390, height: 844 }, 'portrait'],
    [{ width: 430, height: 932 }, 'portrait'],
    [{ width: 1280, height: 720 }, 'desktop'],
    [{ width: 1440, height: 900 }, 'desktop'],
  ] as const)('maps %o to %s', (viewport, expected) => {
    expect(resolveCityUiLayout(viewport)).toBe(expected);
  });

  it('rejects non-positive viewport dimensions', () => {
    expect(() => resolveCityUiLayout({ width: 0, height: 390 })).toThrow(
      'city-ui:invalid-viewport',
    );
  });
});
