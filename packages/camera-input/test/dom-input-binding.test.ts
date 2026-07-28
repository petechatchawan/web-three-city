import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bindWorldInput,
  type CameraInteractionController,
  type PrimaryPointerToolDelegate,
  type ScreenPoint,
  type WorldInputBinding,
} from '../src/index.js';

let canvas: HTMLCanvasElement;
let button: HTMLButtonElement;
let input: HTMLInputElement;
let onEligibleTap: ReturnType<typeof vi.fn>;
let onReset: ReturnType<typeof vi.fn>;
let camera: {
  panScreen: ReturnType<typeof vi.fn>;
  zoomAt: ReturnType<typeof vi.fn>;
  rotateYawAt: ReturnType<typeof vi.fn>;
  tiltPitchAt: ReturnType<typeof vi.fn>;
  rotateLeft: ReturnType<typeof vi.fn>;
  rotateRight: ReturnType<typeof vi.fn>;
};

function dispatchPointer(
  target: EventTarget,
  type: string,
  id: number,
  x: number,
  y: number,
): PointerEvent {
  const event = new window.PointerEvent(type, {
    pointerId: id,
    pointerType: 'touch',
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
    isPrimary: id === 1,
  });
  target.dispatchEvent(event);
  return event;
}

function createTool(
  enabled = true,
  claim = true,
): {
  readonly delegate: PrimaryPointerToolDelegate;
  readonly isEnabled: ReturnType<typeof vi.fn>;
  readonly begin: ReturnType<typeof vi.fn>;
  readonly move: ReturnType<typeof vi.fn>;
  readonly end: ReturnType<typeof vi.fn>;
  readonly cancel: ReturnType<typeof vi.fn>;
  readonly cancelAll: ReturnType<typeof vi.fn>;
} {
  const isEnabled = vi.fn(() => enabled);
  const begin = vi.fn(() => claim);
  const move = vi.fn();
  const end = vi.fn();
  const cancel = vi.fn();
  const cancelAll = vi.fn();
  return {
    delegate: { isEnabled, begin, move, end, cancel, cancelAll },
    isEnabled,
    begin,
    move,
    end,
    cancel,
    cancelAll,
  };
}

function createBinding(tool?: PrimaryPointerToolDelegate): WorldInputBinding {
  return bindWorldInput({
    canvas,
    keyboardTarget: window,
    camera: camera as unknown as CameraInteractionController,
    onEligibleTap: onEligibleTap as unknown as (point: ScreenPoint) => void,
    onReset: onReset as unknown as () => void,
    ...(tool === undefined ? {} : { tool }),
  });
}

beforeEach(() => {
  document.body.innerHTML = '<canvas id="world"></canvas><button>UI</button><input />';
  canvas = document.querySelector('#world')!;
  button = document.querySelector('button')!;
  input = document.querySelector('input')!;
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.hasPointerCapture = vi.fn(() => true);
  onEligibleTap = vi.fn();
  onReset = vi.fn();
  camera = {
    panScreen: vi.fn(),
    zoomAt: vi.fn(),
    rotateYawAt: vi.fn(),
    tiltPitchAt: vi.fn(),
    rotateLeft: vi.fn(),
    rotateRight: vi.fn(),
  };
});

describe('bindWorldInput', () => {
  it('captures accepted world pointers and pans without tapping after drag', () => {
    const binding = createBinding();
    dispatchPointer(canvas, 'pointerdown', 1, 20, 20);
    dispatchPointer(canvas, 'pointermove', 1, 40, 20);
    dispatchPointer(canvas, 'pointerup', 1, 40, 20);

    expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
    expect(camera.panScreen).toHaveBeenCalledWith({ x: 20, y: 0 });
    expect(onEligibleTap).not.toHaveBeenCalled();
    expect(binding.activePointerCount).toBe(0);
    binding.dispose();
  });

  it('emits one eligible tap and releases pointer capture', () => {
    const binding = createBinding();
    dispatchPointer(canvas, 'pointerdown', 1, 20, 20);
    dispatchPointer(canvas, 'pointerup', 1, 24, 23);

    expect(onEligibleTap).toHaveBeenCalledWith({ x: 24, y: 23 });
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);
    binding.dispose();
  });

  it('blocks a session originating from UI or a configured blocking target', () => {
    const binding = createBinding();
    dispatchPointer(button, 'pointerdown', 1, 20, 20);
    dispatchPointer(canvas, 'pointermove', 1, 60, 20);
    dispatchPointer(canvas, 'pointerup', 1, 60, 20);

    expect(camera.panScreen).not.toHaveBeenCalled();
    expect(onEligibleTap).not.toHaveBeenCalled();
    binding.dispose();
  });

  it('anchors wheel zoom at the pointer and prevents page scrolling', () => {
    const binding = createBinding();
    const event = new window.WheelEvent('wheel', {
      deltaY: -120,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperties(event, {
      clientX: { value: 100 },
      clientY: { value: 80 },
    });
    canvas.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(camera.zoomAt).toHaveBeenCalledWith({ x: 100, y: 80 }, Math.exp(0.12));
    binding.dispose();
  });

  it('maps Q, E, and Home while ignoring shortcuts in form controls', () => {
    const binding = createBinding();
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'q', bubbles: true }));
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'E', bubbles: true }));
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));

    expect(camera.rotateLeft).toHaveBeenCalledOnce();
    expect(camera.rotateRight).toHaveBeenCalledOnce();
    expect(onReset).toHaveBeenCalledOnce();

    input.focus();
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    expect(camera.rotateRight).toHaveBeenCalledOnce();
    binding.dispose();
  });

  it('clears cancellation, blur, and explicit interruption without synthetic tap', () => {
    const binding = createBinding();
    dispatchPointer(canvas, 'pointerdown', 1, 20, 20);
    binding.clearActiveSession();
    dispatchPointer(canvas, 'pointerup', 1, 20, 20);

    dispatchPointer(canvas, 'pointerdown', 2, 30, 30);
    window.dispatchEvent(new Event('blur'));
    dispatchPointer(canvas, 'pointerup', 2, 30, 30);

    dispatchPointer(canvas, 'pointerdown', 3, 40, 40);
    dispatchPointer(canvas, 'pointercancel', 3, 40, 40);

    expect(onEligibleTap).not.toHaveBeenCalled();
    expect(binding.activePointerCount).toBe(0);
    binding.dispose();
  });

  it('routes a claimed primary pointer to the tool instead of camera pan or tap', () => {
    const tool = createTool();
    const binding = createBinding(tool.delegate);

    dispatchPointer(canvas, 'pointerdown', 1, 100, 100);
    dispatchPointer(canvas, 'pointermove', 1, 140, 100);
    dispatchPointer(canvas, 'pointerup', 1, 140, 100);

    expect(tool.begin).toHaveBeenCalledWith(1, { x: 100, y: 100 });
    expect(tool.move).toHaveBeenCalledWith(1, { x: 140, y: 100 });
    expect(tool.end).toHaveBeenCalledWith(1, { x: 140, y: 100 });
    expect(camera.panScreen).not.toHaveBeenCalled();
    expect(onEligibleTap).not.toHaveBeenCalled();
    expect(binding.activePointerCount).toBe(0);
    binding.dispose();
  });

  it('falls back to normal camera input when the tool is disabled or declines the pointer', () => {
    const disabled = createTool(false, true);
    let binding = createBinding(disabled.delegate);
    dispatchPointer(canvas, 'pointerdown', 1, 20, 20);
    dispatchPointer(canvas, 'pointermove', 1, 40, 20);
    dispatchPointer(canvas, 'pointerup', 1, 40, 20);
    expect(disabled.begin).not.toHaveBeenCalled();
    expect(camera.panScreen).toHaveBeenCalled();
    binding.dispose();

    camera.panScreen.mockClear();
    const declined = createTool(true, false);
    binding = createBinding(declined.delegate);
    dispatchPointer(canvas, 'pointerdown', 2, 20, 20);
    dispatchPointer(canvas, 'pointermove', 2, 40, 20);
    dispatchPointer(canvas, 'pointerup', 2, 40, 20);
    expect(declined.begin).toHaveBeenCalledOnce();
    expect(camera.panScreen).toHaveBeenCalled();
    binding.dispose();
  });

  it('cancels the tool and transfers two contacts to camera gestures', () => {
    const tool = createTool();
    const binding = createBinding(tool.delegate);
    dispatchPointer(canvas, 'pointerdown', 1, 100, 100);
    dispatchPointer(canvas, 'pointermove', 1, 110, 100);
    dispatchPointer(canvas, 'pointerdown', 2, 200, 100);

    for (const offset of [10, 20, 30, 40]) {
      dispatchPointer(canvas, 'pointermove', 1, 110 - offset, 100);
      dispatchPointer(canvas, 'pointermove', 2, 200 + offset, 100);
    }

    expect(tool.cancelAll).toHaveBeenCalledOnce();
    expect(tool.move).toHaveBeenCalledTimes(1);
    expect(camera.zoomAt).toHaveBeenCalled();
    expect(binding.activePointerCount).toBe(2);

    dispatchPointer(canvas, 'pointerup', 1, 70, 100);
    dispatchPointer(canvas, 'pointerup', 2, 240, 100);
    expect(binding.activePointerCount).toBe(0);
    binding.dispose();
  });

  it('cancels a claimed tool pointer on pointercancel', () => {
    const tool = createTool();
    const binding = createBinding(tool.delegate);
    dispatchPointer(canvas, 'pointerdown', 1, 20, 20);
    dispatchPointer(canvas, 'pointercancel', 1, 20, 20);

    expect(tool.cancel).toHaveBeenCalledWith(1);
    expect(tool.end).not.toHaveBeenCalled();
    expect(binding.activePointerCount).toBe(0);
    binding.dispose();
  });

  it('cancels a claimed tool session on blur, explicit clear, and lost capture', () => {
    const tool = createTool();
    const binding = createBinding(tool.delegate);

    dispatchPointer(canvas, 'pointerdown', 1, 20, 20);
    window.dispatchEvent(new Event('blur'));
    dispatchPointer(canvas, 'pointerdown', 2, 30, 30);
    binding.clearActiveSession();
    dispatchPointer(canvas, 'pointerdown', 3, 40, 40);
    dispatchPointer(canvas, 'lostpointercapture', 3, 40, 40);

    expect(tool.cancelAll).toHaveBeenCalledTimes(3);
    expect(binding.activePointerCount).toBe(0);
    binding.dispose();
  });

  it('disposes listeners idempotently', () => {
    const binding = createBinding();
    binding.dispose();
    binding.dispose();

    dispatchPointer(canvas, 'pointerdown', 1, 20, 20);
    dispatchPointer(canvas, 'pointerup', 1, 20, 20);
    expect(onEligibleTap).not.toHaveBeenCalled();
  });
});
