export interface DemandAnimationLoop {
  wake(): void;
  dispose(): void;
}

export function createDemandAnimationLoop(input: {
  readonly now: () => number;
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly onFrame: (deltaSeconds: number) => boolean;
}): DemandAnimationLoop {
  let frameHandle: number | undefined;
  let previousTimeMs: number | undefined;
  let disposed = false;

  const schedule = (): void => {
    if (disposed || frameHandle !== undefined) return;
    frameHandle = input.requestFrame(frame);
  };

  const frame = (timeMs: number): void => {
    if (disposed) return;
    frameHandle = undefined;
    const previous = previousTimeMs ?? input.now();
    previousTimeMs = timeMs;
    const deltaSeconds = Math.max(0, (timeMs - previous) / 1000);
    if (input.onFrame(deltaSeconds)) schedule();
    else previousTimeMs = undefined;
  };

  return Object.freeze({
    wake(): void {
      if (disposed) return;
      if (previousTimeMs === undefined) previousTimeMs = input.now();
      schedule();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (frameHandle !== undefined) input.cancelFrame(frameHandle);
      frameHandle = undefined;
      previousTimeMs = undefined;
    },
  });
}
