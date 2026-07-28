import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GESTURE_OPTIONS,
  GestureController,
  classifyTwoFingerAxes,
  type PointDelta,
  type TwoFingerGestureFrame,
} from '../src/index.js';

const OPTIONS = DEFAULT_GESTURE_OPTIONS;

describe('classifyTwoFingerAxes', () => {
  it.each([
    [{ pinchLogDelta: 0.024, yawRadians: 0.006, pitchCssPixels: 0 }, 'pinch'],
    [{ pinchLogDelta: 0.006, yawRadians: 0.024, pitchCssPixels: 0 }, 'yaw'],
    [{ pinchLogDelta: 0, yawRadians: 0.006, pitchCssPixels: 6 }, 'pitch'],
    [{ pinchLogDelta: 0.012, yawRadians: 0.012, pitchCssPixels: 3 }, 'pinch'],
  ] as const)('classifies %o as %s', (input, dominant) => {
    expect(classifyTwoFingerAxes(input, OPTIONS).dominant).toBe(dominant);
  });

  it('quarter-scales independently qualified secondary axes', () => {
    const result = classifyTwoFingerAxes(
      { pinchLogDelta: 0.012, yawRadians: 0.024, pitchCssPixels: 3 },
      OPTIONS,
    );

    expect(result.dominant).toBe('yaw');
    expect(result.zoomScale).toBeCloseTo(Math.exp(0.012 * 0.25));
    expect(result.yawRadians).toBeCloseTo(0.024);
    expect(result.pitchCssPixels).toBeCloseTo(3 * 0.25);
  });

  it('returns neutral output when no axis reaches its threshold', () => {
    expect(
      classifyTwoFingerAxes(
        { pinchLogDelta: 0.001, yawRadians: 0.001, pitchCssPixels: 0.5 },
        OPTIONS,
      ),
    ).toEqual({
      dominant: null,
      zoomScale: 1,
      yawRadians: 0,
      pitchCssPixels: 0,
    });
  });
});

describe('GestureController', () => {
  let taps: PointDelta[];
  let pans: PointDelta[];
  let twoFingerFrames: TwoFingerGestureFrame[];
  let controller: GestureController;

  beforeEach(() => {
    taps = [];
    pans = [];
    twoFingerFrames = [];
    controller = new GestureController({
      onTap: (point) => taps.push(point),
      onPan: (delta) => pans.push(delta),
      onTwoFingerGesture: (frame) => twoFingerFrames.push(frame),
    });
  });

  it('emits tap only for an eligible one-pointer release inside tap slop', () => {
    controller.pointerDown({ id: 1, x: 20, y: 20 });
    controller.pointerUp({ id: 1, x: 25, y: 24 });

    expect(taps).toEqual([{ x: 25, y: 24 }]);
    expect(controller.state).toBe('idle');
  });

  it('promotes one pointer to pan and never emits a later tap', () => {
    controller.pointerDown({ id: 1, x: 20, y: 20 });
    controller.pointerMove({ id: 1, x: 40, y: 20 });
    controller.pointerUp({ id: 1, x: 40, y: 20 });

    expect(pans).toEqual([{ x: 20, y: 0 }]);
    expect(taps).toEqual([]);
  });

  it('clears cancellation without synthetic tap or retained pointers', () => {
    controller.pointerDown({ id: 1, x: 20, y: 20 });
    controller.pointerCancel(1);

    expect(taps).toEqual([]);
    expect(controller.activePointerCount).toBe(0);
    expect(controller.state).toBe('idle');
  });

  it('emits no delta on the one-to-two pointer transition', () => {
    controller.pointerDown({ id: 1, x: 100, y: 100 });
    controller.pointerDown({ id: 2, x: 200, y: 100 });

    expect(pans).toEqual([]);
    expect(twoFingerFrames).toEqual([]);
    expect(controller.state).toBe('two-pointer-pending');
  });

  it('requires two consecutive pair frames before activating pinch', () => {
    controller.pointerDown({ id: 1, x: 100, y: 100 });
    controller.pointerDown({ id: 2, x: 200, y: 100 });

    controller.pointerMove({ id: 1, x: 95, y: 100 });
    controller.pointerMove({ id: 2, x: 205, y: 100 });
    expect(twoFingerFrames).toEqual([]);

    controller.pointerMove({ id: 1, x: 90, y: 100 });
    controller.pointerMove({ id: 2, x: 210, y: 100 });

    expect(twoFingerFrames).toHaveLength(1);
    expect(twoFingerFrames[0]?.dominant).toBe('pinch');
    expect(twoFingerFrames[0]?.zoomScale).toBeGreaterThan(1);
    expect(controller.state).toBe('two-pointer-active');
  });

  it('recognizes parallel vertical movement as pitch and consumes vertical pan', () => {
    controller.pointerDown({ id: 1, x: 100, y: 100 });
    controller.pointerDown({ id: 2, x: 200, y: 100 });

    for (const offset of [8, 16]) {
      controller.pointerMove({ id: 1, x: 100, y: 100 + offset });
      controller.pointerMove({ id: 2, x: 200, y: 100 + offset });
    }

    expect(twoFingerFrames).toHaveLength(1);
    expect(twoFingerFrames[0]).toMatchObject({
      dominant: 'pitch',
      panDelta: { x: 0, y: 0 },
    });
    expect(twoFingerFrames[0]?.pitchCssPixels).toBeGreaterThan(0);
  });

  it('suppresses a third-contact session until every contact releases', () => {
    controller.pointerDown({ id: 1, x: 100, y: 100 });
    controller.pointerDown({ id: 2, x: 200, y: 100 });
    controller.pointerDown({ id: 3, x: 150, y: 150 });
    controller.pointerMove({ id: 1, x: 90, y: 100 });
    controller.pointerUp({ id: 3, x: 150, y: 150 });
    controller.pointerMove({ id: 2, x: 220, y: 100 });

    expect(controller.state).toBe('suppressed');
    expect(taps).toEqual([]);
    expect(pans).toEqual([]);
    expect(twoFingerFrames).toEqual([]);

    controller.pointerUp({ id: 1, x: 90, y: 100 });
    controller.pointerUp({ id: 2, x: 220, y: 100 });
    expect(controller.state).toBe('idle');
  });

  it('keeps legacy wheel and keyboard callbacks during product migration', () => {
    const onZoom = vi.fn();
    const onRotate = vi.fn();
    const onReset = vi.fn();
    const legacy = new GestureController({ onZoom, onRotate, onReset });

    legacy.wheel(100);
    legacy.keyDown('q');
    legacy.keyDown('E');
    legacy.keyDown('Home');

    expect(onZoom).toHaveBeenCalledWith(Math.exp(-0.1));
    expect(onRotate).toHaveBeenNthCalledWith(1, -Math.PI / 2);
    expect(onRotate).toHaveBeenNthCalledWith(2, Math.PI / 2);
    expect(onReset).toHaveBeenCalledOnce();
  });
});
