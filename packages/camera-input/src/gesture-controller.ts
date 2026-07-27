export interface PointerSample {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

export interface PointDelta {
  readonly x: number;
  readonly y: number;
}

export type TwoFingerAxis = 'pinch' | 'yaw' | 'pitch';

export interface TwoFingerAxisInput {
  readonly pinchLogDelta: number;
  readonly yawRadians: number;
  readonly pitchCssPixels: number;
}

export interface TwoFingerAxisResult {
  readonly dominant: TwoFingerAxis | null;
  readonly zoomScale: number;
  readonly yawRadians: number;
  readonly pitchCssPixels: number;
}

export interface TwoFingerGestureFrame extends TwoFingerAxisResult {
  readonly dominant: TwoFingerAxis;
  readonly centroid: PointDelta;
  readonly panDelta: PointDelta;
}

export interface GestureHandlers {
  readonly onTap?: (point: PointDelta) => void;
  readonly onPan?: (delta: PointDelta) => void;
  readonly onTwoFingerGesture?: (frame: TwoFingerGestureFrame) => void;
  readonly onZoom?: (scale: number) => void;
  readonly onRotate?: (radians: number) => void;
  readonly onReset?: () => void;
}

export interface GestureOptions {
  readonly tapSlop?: number;
  readonly tapSlopCssPixels?: number;
  readonly activationFrames?: number;
  readonly pinchLogThreshold?: number;
  readonly yawRadiansThreshold?: number;
  readonly pitchCssPixelsThreshold?: number;
  readonly panNoiseCssPixels?: number;
  readonly secondaryScale?: number;
}

export const DEFAULT_GESTURE_OPTIONS = Object.freeze({
  tapSlopCssPixels: 8,
  activationFrames: 2,
  pinchLogThreshold: 0.012,
  yawRadiansThreshold: 0.012,
  pitchCssPixelsThreshold: 3,
  panNoiseCssPixels: 0.75,
  secondaryScale: 0.25,
});

export interface ResolvedGestureOptions {
  readonly tapSlopCssPixels: number;
  readonly activationFrames: number;
  readonly pinchLogThreshold: number;
  readonly yawRadiansThreshold: number;
  readonly pitchCssPixelsThreshold: number;
  readonly panNoiseCssPixels: number;
  readonly secondaryScale: number;
}

export type GestureSessionState =
  | 'idle'
  | 'one-pointer-pending'
  | 'one-pointer-pan'
  | 'two-pointer-pending'
  | 'two-pointer-active'
  | 'suppressed';

interface PointerState {
  readonly startX: number;
  readonly startY: number;
  x: number;
  y: number;
}

interface PairMetrics {
  readonly centroidX: number;
  readonly centroidY: number;
  readonly distance: number;
  readonly angle: number;
}

function isFiniteSample(sample: PointerSample): boolean {
  return Number.isFinite(sample.id) && Number.isFinite(sample.x) && Number.isFinite(sample.y);
}

function resolveOptions(options: GestureOptions): ResolvedGestureOptions {
  const resolved = {
    tapSlopCssPixels:
      options.tapSlopCssPixels ?? options.tapSlop ?? DEFAULT_GESTURE_OPTIONS.tapSlopCssPixels,
    activationFrames: options.activationFrames ?? DEFAULT_GESTURE_OPTIONS.activationFrames,
    pinchLogThreshold: options.pinchLogThreshold ?? DEFAULT_GESTURE_OPTIONS.pinchLogThreshold,
    yawRadiansThreshold: options.yawRadiansThreshold ?? DEFAULT_GESTURE_OPTIONS.yawRadiansThreshold,
    pitchCssPixelsThreshold:
      options.pitchCssPixelsThreshold ?? DEFAULT_GESTURE_OPTIONS.pitchCssPixelsThreshold,
    panNoiseCssPixels: options.panNoiseCssPixels ?? DEFAULT_GESTURE_OPTIONS.panNoiseCssPixels,
    secondaryScale: options.secondaryScale ?? DEFAULT_GESTURE_OPTIONS.secondaryScale,
  };

  if (
    !Object.values(resolved).every(Number.isFinite) ||
    resolved.tapSlopCssPixels < 0 ||
    resolved.activationFrames < 1 ||
    !Number.isInteger(resolved.activationFrames) ||
    resolved.pinchLogThreshold <= 0 ||
    resolved.yawRadiansThreshold <= 0 ||
    resolved.pitchCssPixelsThreshold <= 0 ||
    resolved.panNoiseCssPixels < 0 ||
    resolved.secondaryScale < 0 ||
    resolved.secondaryScale > 1
  ) {
    throw new RangeError('gesture:invalid-options');
  }
  return resolved;
}

function pairMetrics(first: Readonly<PointDelta>, second: Readonly<PointDelta>): PairMetrics {
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

export function classifyTwoFingerAxes(
  input: TwoFingerAxisInput,
  options: Readonly<ResolvedGestureOptions> = DEFAULT_GESTURE_OPTIONS,
): TwoFingerAxisResult {
  if (!Object.values(input).every(Number.isFinite)) {
    return { dominant: null, zoomScale: 1, yawRadians: 0, pitchCssPixels: 0 };
  }

  const scores: ReadonlyArray<readonly [TwoFingerAxis, number]> = [
    ['pinch', Math.abs(input.pinchLogDelta) / options.pinchLogThreshold],
    ['yaw', Math.abs(input.yawRadians) / options.yawRadiansThreshold],
    ['pitch', Math.abs(input.pitchCssPixels) / options.pitchCssPixelsThreshold],
  ];
  let dominant: TwoFingerAxis | null = null;
  let dominantScore = 1;
  for (const [axis, score] of scores) {
    if (score > dominantScore || (score === dominantScore && dominant === null)) {
      dominant = axis;
      dominantScore = score;
    }
  }
  if (dominant === null) {
    return { dominant: null, zoomScale: 1, yawRadians: 0, pitchCssPixels: 0 };
  }

  const qualified = Object.fromEntries(scores.map(([axis, score]) => [axis, score >= 1])) as Record<
    TwoFingerAxis,
    boolean
  >;
  const scaleFor = (axis: TwoFingerAxis): number =>
    axis === dominant ? 1 : qualified[axis] ? options.secondaryScale : 0;

  return {
    dominant,
    zoomScale: Math.exp(input.pinchLogDelta * scaleFor('pinch')),
    yawRadians: input.yawRadians * scaleFor('yaw'),
    pitchCssPixels: input.pitchCssPixels * scaleFor('pitch'),
  };
}

export class GestureController {
  readonly #handlers: GestureHandlers;
  readonly #options: ResolvedGestureOptions;
  readonly #pointers = new Map<number, PointerState>();
  readonly #pairFrameStart = new Map<number, PointDelta>();
  readonly #pairMoved = new Set<number>();
  #state: GestureSessionState = 'idle';
  #pairIds: readonly [number, number] | null = null;
  #candidateAxis: TwoFingerAxis | null = null;
  #candidateFrames = 0;
  #establishedAxis: TwoFingerAxis | null = null;

  constructor(handlers: GestureHandlers, options: GestureOptions = {}) {
    this.#handlers = handlers;
    this.#options = resolveOptions(options);
  }

  get activePointerCount(): number {
    return this.#pointers.size;
  }

  get state(): GestureSessionState {
    return this.#state;
  }

  pointerDown(sample: PointerSample): void {
    if (!isFiniteSample(sample) || this.#pointers.has(sample.id)) return;
    this.#pointers.set(sample.id, {
      startX: sample.x,
      startY: sample.y,
      x: sample.x,
      y: sample.y,
    });

    if (this.#state === 'suppressed' || this.#pointers.size >= 3) {
      this.#enterSuppressed();
      return;
    }
    if (this.#pointers.size === 1) {
      this.#state = 'one-pointer-pending';
      return;
    }
    this.#beginTwoPointerSession();
  }

  pointerMove(sample: PointerSample): void {
    if (!isFiniteSample(sample)) return;
    const pointer = this.#pointers.get(sample.id);
    if (pointer === undefined) return;
    if (this.#state === 'suppressed') {
      pointer.x = sample.x;
      pointer.y = sample.y;
      return;
    }

    if (this.#state === 'one-pointer-pending' || this.#state === 'one-pointer-pan') {
      const delta = { x: sample.x - pointer.x, y: sample.y - pointer.y };
      pointer.x = sample.x;
      pointer.y = sample.y;
      const totalDistance = Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY);
      if (this.#state === 'one-pointer-pending' && totalDistance > this.#options.tapSlopCssPixels) {
        this.#state = 'one-pointer-pan';
      }
      if (this.#state === 'one-pointer-pan' && (delta.x !== 0 || delta.y !== 0)) {
        this.#handlers.onPan?.(delta);
      }
      return;
    }

    if (
      (this.#state === 'two-pointer-pending' || this.#state === 'two-pointer-active') &&
      this.#pairIds?.includes(sample.id)
    ) {
      pointer.x = sample.x;
      pointer.y = sample.y;
      this.#pairMoved.add(sample.id);
      if (this.#pairIds.every((id) => this.#pairMoved.has(id))) this.#processPairFrame();
    }
  }

  pointerUp(sample: PointerSample): void {
    const pointer = this.#pointers.get(sample.id);
    if (pointer === undefined) return;
    if (Number.isFinite(sample.x) && Number.isFinite(sample.y)) {
      pointer.x = sample.x;
      pointer.y = sample.y;
    }

    if (this.#state === 'suppressed') {
      this.#pointers.delete(sample.id);
      if (this.#pointers.size === 0) this.#resetSessionState();
      return;
    }

    if (this.#state === 'two-pointer-pending' || this.#state === 'two-pointer-active') {
      this.#pointers.delete(sample.id);
      this.#clearPairState();
      if (this.#pointers.size === 0) this.#resetSessionState();
      else this.#state = 'suppressed';
      return;
    }

    const isTap =
      this.#state === 'one-pointer-pending' &&
      Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) <=
        this.#options.tapSlopCssPixels;
    this.#pointers.delete(sample.id);
    this.#resetSessionState();
    if (isTap) this.#handlers.onTap?.({ x: pointer.x, y: pointer.y });
  }

  pointerCancel(id: number): void {
    if (!this.#pointers.has(id)) return;
    this.clearActiveSession();
  }

  clearActiveSession(): void {
    this.#pointers.clear();
    this.#resetSessionState();
  }

  wheel(deltaY: number): void {
    if (!Number.isFinite(deltaY)) return;
    this.#handlers.onZoom?.(Math.exp(-deltaY * 0.001));
  }

  keyDown(key: string): void {
    if (key === 'Home') this.#handlers.onReset?.();
    if (key.toLowerCase() === 'q') this.#handlers.onRotate?.(-Math.PI / 2);
    if (key.toLowerCase() === 'e') this.#handlers.onRotate?.(Math.PI / 2);
  }

  #beginTwoPointerSession(): void {
    const ids = [...this.#pointers.keys()].slice(0, 2);
    if (ids.length !== 2) return;
    this.#pairIds = [ids[0]!, ids[1]!];
    this.#state = 'two-pointer-pending';
    this.#candidateAxis = null;
    this.#candidateFrames = 0;
    this.#establishedAxis = null;
    this.#pairMoved.clear();
    this.#pairFrameStart.clear();
    for (const id of this.#pairIds) {
      const pointer = this.#pointers.get(id)!;
      this.#pairFrameStart.set(id, { x: pointer.x, y: pointer.y });
    }
  }

  #processPairFrame(): void {
    const ids = this.#pairIds;
    if (ids === null) return;
    const firstStart = this.#pairFrameStart.get(ids[0]);
    const secondStart = this.#pairFrameStart.get(ids[1]);
    const first = this.#pointers.get(ids[0]);
    const second = this.#pointers.get(ids[1]);
    if (
      firstStart === undefined ||
      secondStart === undefined ||
      first === undefined ||
      second === undefined
    ) {
      this.#enterSuppressed();
      return;
    }

    const firstCurrent = { x: first.x, y: first.y };
    const secondCurrent = { x: second.x, y: second.y };
    const before = pairMetrics(firstStart, secondStart);
    const after = pairMetrics(firstCurrent, secondCurrent);
    const firstDelta = { x: firstCurrent.x - firstStart.x, y: firstCurrent.y - firstStart.y };
    const secondDelta = {
      x: secondCurrent.x - secondStart.x,
      y: secondCurrent.y - secondStart.y,
    };
    const centroidDelta = {
      x: (firstDelta.x + secondDelta.x) / 2,
      y: (firstDelta.y + secondDelta.y) / 2,
    };
    const sameVerticalDirection =
      Math.sign(firstDelta.y) === Math.sign(secondDelta.y) && Math.sign(firstDelta.y) !== 0;
    const verticalMismatch = Math.abs(firstDelta.y - secondDelta.y) / 2;
    const horizontalNoise = Math.max(Math.abs(firstDelta.x), Math.abs(secondDelta.x)) * 0.25;
    const rawVertical = sameVerticalDirection ? centroidDelta.y : 0;
    const pitchCssPixels =
      Math.sign(rawVertical) *
      Math.max(0, Math.abs(rawVertical) - verticalMismatch - horizontalNoise);
    const axisInput: TwoFingerAxisInput = {
      pinchLogDelta:
        before.distance > 0 && after.distance > 0 ? Math.log(after.distance / before.distance) : 0,
      yawRadians: normalizeAngle(after.angle - before.angle),
      pitchCssPixels,
    };
    const result = classifyTwoFingerAxes(axisInput, this.#options);

    for (const [id, current] of [
      [ids[0], firstCurrent],
      [ids[1], secondCurrent],
    ] as const) {
      this.#pairFrameStart.set(id, current);
    }
    this.#pairMoved.clear();

    if (result.dominant === null) {
      this.#candidateAxis = null;
      this.#candidateFrames = 0;
      return;
    }

    if (this.#establishedAxis !== result.dominant) {
      if (this.#candidateAxis === result.dominant) this.#candidateFrames += 1;
      else {
        this.#candidateAxis = result.dominant;
        this.#candidateFrames = 1;
      }
      if (this.#candidateFrames < this.#options.activationFrames) return;
      this.#establishedAxis = result.dominant;
      this.#state = 'two-pointer-active';
    }

    const panMagnitude = Math.hypot(centroidDelta.x, centroidDelta.y);
    const panDelta =
      panMagnitude < this.#options.panNoiseCssPixels
        ? { x: 0, y: 0 }
        : {
            x: centroidDelta.x,
            y: result.dominant === 'pitch' ? 0 : centroidDelta.y,
          };
    const frame: TwoFingerGestureFrame = {
      ...result,
      dominant: result.dominant,
      centroid: { x: after.centroidX, y: after.centroidY },
      panDelta,
    };
    this.#handlers.onTwoFingerGesture?.(frame);
    if (this.#handlers.onTwoFingerGesture === undefined) {
      if (panDelta.x !== 0 || panDelta.y !== 0) this.#handlers.onPan?.(panDelta);
      if (frame.zoomScale !== 1) this.#handlers.onZoom?.(frame.zoomScale);
      if (frame.yawRadians !== 0) this.#handlers.onRotate?.(frame.yawRadians);
    }
  }

  #enterSuppressed(): void {
    this.#state = 'suppressed';
    this.#clearPairState();
  }

  #clearPairState(): void {
    this.#pairIds = null;
    this.#pairFrameStart.clear();
    this.#pairMoved.clear();
    this.#candidateAxis = null;
    this.#candidateFrames = 0;
    this.#establishedAxis = null;
  }

  #resetSessionState(): void {
    this.#state = 'idle';
    this.#clearPairState();
  }
}
