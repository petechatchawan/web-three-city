import { describe, expect, it } from 'vitest';
import { createBuildingToolController } from './building-tool-controller.js';

describe('building tool controller', () => {
  it('emits one immutable request on pointer release', () => {
    const controller = createBuildingToolController(() => 'building-bulldoze');
    expect(controller.begin(7, { x: 2, z: 3 })).toBe(true);
    controller.move(7, { x: 3, z: 3 });
    expect(controller.end(7, null)).toEqual({ mode: 'building-bulldoze', cell: { x: 3, z: 3 } });
    expect(controller.getState().strokeActive).toBe(false);
  });
});
