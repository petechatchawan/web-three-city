import { describe, expect, it } from 'vitest';
import { calculateFittedOrthographicSize } from '../src/index.js';

const BASE_REQUEST = {
  targetX: 0,
  targetZ: 0,
  yawDegrees: 45,
  pitchDegrees: 50,
  worldHalfWidth: 64,
  worldHalfHeight: 64,
  minimumWorldY: -1.5,
  maximumWorldY: 2,
  marginRatio: 0.08,
} as const;

describe('calculateFittedOrthographicSize', () => {
  it.each([
    ['desktop', 1440, 900, { top: 0, right: 0, bottom: 0, left: 372 }],
    ['tablet', 1024, 768, { top: 0, right: 0, bottom: 0, left: 340 }],
    ['mobile', 390, 844, { top: 168, right: 0, bottom: 0, left: 0 }],
    ['ultrawide', 2560, 1080, { top: 0, right: 0, bottom: 0, left: 372 }],
  ] as const)('fits all projected corners for %s', (_name, width, height, insets) => {
    const fit = calculateFittedOrthographicSize({
      ...BASE_REQUEST,
      viewportWidth: width,
      viewportHeight: height,
      insets,
    });

    expect(fit.usableWidth).toBe(width - insets.left - insets.right);
    expect(fit.usableHeight).toBe(height - insets.top - insets.bottom);
    expect(fit.orthographicSize).toBeGreaterThan(0);

    for (const corner of fit.projectedCorners) {
      expect(Math.abs(corner.x)).toBeLessThanOrEqual(fit.halfWidth + 1e-6);
      expect(Math.abs(corner.y)).toBeLessThanOrEqual(fit.halfHeight + 1e-6);
    }
  });

  it('adds the accepted eight-percent framing margin', () => {
    const withoutMargin = calculateFittedOrthographicSize({
      ...BASE_REQUEST,
      viewportWidth: 1440,
      viewportHeight: 900,
      insets: { top: 0, right: 0, bottom: 0, left: 372 },
      marginRatio: 0,
    });
    const withMargin = calculateFittedOrthographicSize({
      ...BASE_REQUEST,
      viewportWidth: 1440,
      viewportHeight: 900,
      insets: { top: 0, right: 0, bottom: 0, left: 372 },
    });

    expect(withMargin.orthographicSize).toBeCloseTo(withoutMargin.orthographicSize * 1.08);
  });

  it('rejects a viewport consumed by insets', () => {
    expect(() =>
      calculateFittedOrthographicSize({
        ...BASE_REQUEST,
        viewportWidth: 300,
        viewportHeight: 200,
        insets: { top: 100, right: 150, bottom: 100, left: 150 },
      }),
    ).toThrowError(expect.objectContaining({ code: 'camera:invalid-usable-viewport' }));
  });

  it.each([
    ['viewport width', { viewportWidth: Number.NaN }],
    ['yaw', { yawDegrees: Number.POSITIVE_INFINITY }],
    ['world height', { maximumWorldY: Number.NaN }],
    ['margin', { marginRatio: -0.01 }],
  ] as const)('rejects invalid %s input', (_name, override) => {
    expect(() =>
      calculateFittedOrthographicSize({
        ...BASE_REQUEST,
        viewportWidth: 1440,
        viewportHeight: 900,
        insets: { top: 0, right: 0, bottom: 0, left: 372 },
        ...override,
      }),
    ).toThrow();
  });
});
