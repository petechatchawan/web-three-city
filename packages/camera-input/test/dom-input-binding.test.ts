import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bindWorldInput,
  type CameraInteractionController,
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

function createBinding(): WorldInputBinding {
  return bindWorldInput({
    canvas,
    keyboardTarget: window,
    camera: camera as unknown as CameraInteractionController,
    onEligibleTap: onEligibleTap as unknown as (point: ScreenPoint) => void,
    onReset: onReset as unknown as () => void,
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
      clientX: 100,
      clientY: 80,
      deltaY: -120,
      bubbles: true,
      cancelable: true,
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

  it('disposes listeners idempotently', () => {
    const binding = createBinding();
    binding.dispose();
    binding.dispose();

    dispatchPointer(canvas, 'pointerdown', 1, 20, 20);
    dispatchPointer(canvas, 'pointerup', 1, 20, 20);
    expect(onEligibleTap).not.toHaveBeenCalled();
  });
});
