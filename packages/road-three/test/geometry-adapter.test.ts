import { describe, expect, it } from 'vitest';
import { createRoadGeometry, createRoadMeshData } from '../src/index.js';

function validData() {
  return createRoadMeshData({
    positions: new Float32Array([0, 1, 0, 1, 1, 0, 0, 1, 1]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    colors: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]),
    indices: new Uint32Array([0, 2, 1]),
  });
}

describe('Road geometry adapter', () => {
  it('creates matching Three.js attributes for valid mesh data', () => {
    const geometry = createRoadGeometry(validData());

    expect(geometry.getAttribute('position').count).toBe(3);
    expect(geometry.getAttribute('normal').count).toBe(3);
    expect(geometry.getAttribute('color').count).toBe(3);
    expect(geometry.index?.count).toBe(3);
    expect(geometry.boundingBox).not.toBeNull();
    geometry.dispose();
  });

  it.each([
    [
      createRoadMeshData({
        positions: new Float32Array(),
        normals: new Float32Array(),
        colors: new Float32Array(),
        indices: new Uint32Array(),
      }),
      'road-three:invalid-positions',
    ],
    [
      { ...validData(), positions: new Float32Array([0, Number.NaN, 0]) },
      'road-three:invalid-normals',
    ],
    [{ ...validData(), normals: new Float32Array([0, 1, 0]) }, 'road-three:invalid-normals'],
    [{ ...validData(), colors: new Float32Array([1, 1, 1]) }, 'road-three:invalid-colors'],
    [{ ...validData(), indices: new Uint32Array([0, 1]) }, 'road-three:invalid-indices'],
    [{ ...validData(), indices: new Uint32Array([0, 1, 3]) }, 'road-three:index-out-of-range'],
  ])('rejects malformed mesh data', (data, message) => {
    expect(() => createRoadGeometry(data)).toThrow(message);
  });
});
