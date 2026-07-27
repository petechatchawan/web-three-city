import { describe, expect, it, vi } from 'vitest';
import { GestureController } from '../src/gesture-controller.js';

describe('GestureController', () => {
  it('emits a tap only when one pointer stays within the movement slop', () => {
    const onTap = vi.fn();
    const onPan = vi.fn();
    const controller = new GestureController({ onTap, onPan }, { tapSlop: 8 });

    controller.pointerDown({ id: 1, x: 10, y: 10 });
    controller.pointerUp({ id: 1, x: 14, y: 13 });
    expect(onTap).toHaveBeenCalledWith({ x: 14, y: 13 });

    controller.pointerDown({ id: 2, x: 0, y: 0 });
    controller.pointerMove({ id: 2, x: 20, y: 0 });
    controller.pointerUp({ id: 2, x: 20, y: 0 });
    expect(onPan).toHaveBeenCalledWith({ x: 20, y: 0 });
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('normalizes two-pointer pinch and twist gestures', () => {
    const onZoom = vi.fn();
    const onRotate = vi.fn();
    const controller = new GestureController({ onZoom, onRotate });

    controller.pointerDown({ id: 1, x: 0, y: 0 });
    controller.pointerDown({ id: 2, x: 10, y: 0 });
    controller.pointerMove({ id: 2, x: 20, y: 0 });
    controller.pointerMove({ id: 2, x: 0, y: 20 });

    expect(onZoom).toHaveBeenCalled();
    expect(onRotate).toHaveBeenCalled();
  });

  it('clears interrupted gesture state', () => {
    const controller = new GestureController({});
    controller.pointerDown({ id: 1, x: 0, y: 0 });
    controller.pointerCancel(1);

    expect(controller.activePointerCount).toBe(0);
  });
});
