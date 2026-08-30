export interface ViewportRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}
export interface NdcPoint {
  readonly x: number;
  readonly y: number;
}

export function pointerToNdc(
  point: { readonly clientX: number; readonly clientY: number },
  rect: ViewportRect,
): NdcPoint | undefined {
  if (rect.width <= 0 || rect.height <= 0) return undefined;
  const localX = point.clientX - rect.left;
  const localY = point.clientY - rect.top;
  if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height)
    return undefined;
  return Object.freeze({
    x: (localX / rect.width) * 2 - 1,
    y: 1 - (localY / rect.height) * 2,
  });
}
