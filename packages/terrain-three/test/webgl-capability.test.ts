import { describe, expect, it } from 'vitest';
import { detectWebGL2 } from '../src/webgl-capability.js';

describe('WebGL2 capability detection', () => {
  it('returns a typed unsupported result when context creation fails', () => {
    const canvas = document.createElement('canvas');
    canvas.getContext = () => null;

    expect(detectWebGL2(canvas)).toEqual({
      supported: false,
      reason: 'webgl2-unavailable',
    });
  });
});
