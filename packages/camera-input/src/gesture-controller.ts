export interface PointerSample {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

export interface PointDelta {
  readonly x: number;
  readonly y: number;
}

export interface GestureHandlers {
  readonly onTap?: (point: PointDelta) => void;
  readonly onPan?: (delta: PointDelta) => void;
  readonly onZoom?: (scale: number) => void;
  readonly onRotate?: (radians: number) => void;
  readonly onReset?: () => void;
}

export interface GestureOptions {
  readonly tapSlop?: number;
}

interface PointerState {
  readonly startX: number;
  readonly startY: number;
  x: number;
  y: number;
  moved: boolean;
}

interface PairMetrics {
  readonly centroidX: number;
  readonly centroidY: number;
  readonly distance: number;
  readonly angle: number;
}

function pairMetrics(states: readonly PointerState[]): PairMetrics {
  const first = states[0]!;
  const second = states[1]!;
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  return {
    centroidX: (first.x + second.x) / 2,
    centroidY: (first.y + second.y) / 2,
    distance: Math.hypot(deltaX, deltaY),
    angle: Math.atan2(deltaY, deltaX),
  };
}

function normalizeAngle(radians: number): number {
  let normalized = radians;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

export class GestureController {
  readonly #handlers: GestureHandlers;
  readonly #tapSlop: number;
  readonly #pointers = new Map<number, PointerState>();

  constructor(handlers: GestureHandlers, options: GestureOptions = {}) {
    this.#handlers = handlers;
    this.#tapSlop = options.tapSlop ?? 8;
  }

  get activePointerCount(): number {
    return this.#pointers.size;
  }

  pointerDown(sample: PointerSample): void {
    this.#pointers.set(sample.id, {
      startX: sample.x,
      startY: sample.y,
      x: sample.x,
      y: sample.y,
      moved: false,
    });
  }

  pointerMove(sample: PointerSample): void {
    const pointer = this.#pointers.get(sample.id);
    if (pointer === undefined) return;

    if (this.#pointers.size === 1) {
      const delta = { x: sample.x - pointer.x, y: sample.y - pointer.y };
      pointer.x = sample.x;
      pointer.y = sample.y;
      if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > this.#tapSlop) {
        pointer.moved = true;
      }
      if (pointer.moved && (delta.x !== 0 || delta.y !== 0)) this.#handlers.onPan?.(delta);
      return;
    }

    const before = pairMetrics([...this.#pointers.values()].slice(0, 2));
    pointer.x = sample.x;
    pointer.y = sample.y;
    pointer.moved = true;
    const after = pairMetrics([...this.#pointers.values()].slice(0, 2));
    this.#handlers.onPan?.({
      x: after.centroidX - before.centroidX,
      y: after.centroidY - before.centroidY,
    });
    if (before.distance > 0 && after.distance > 0) {
      this.#handlers.onZoom?.(after.distance / before.distance);
    }
    const rotation = normalizeAngle(after.angle - before.angle);
    if (rotation !== 0) this.#handlers.onRotate?.(rotation);
  }

  pointerUp(sample: PointerSample): void {
    const pointer = this.#pointers.get(sample.id);
    if (pointer === undefined) return;
    pointer.x = sample.x;
    pointer.y = sample.y;
    const isTap =
      this.#pointers.size === 1 &&
      !pointer.moved &&
      Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) <= this.#tapSlop;
    this.#pointers.delete(sample.id);
    if (isTap) this.#handlers.onTap?.({ x: sample.x, y: sample.y });
  }

  pointerCancel(id: number): void {
    this.#pointers.delete(id);
  }

  wheel(deltaY: number): void {
    this.#handlers.onZoom?.(Math.exp(-deltaY * 0.001));
  }

  keyDown(key: string): void {
    if (key === 'Home') this.#handlers.onReset?.();
    if (key.toLowerCase() === 'q') this.#handlers.onRotate?.(-Math.PI / 2);
    if (key.toLowerCase() === 'e') this.#handlers.onRotate?.(Math.PI / 2);
  }
}
