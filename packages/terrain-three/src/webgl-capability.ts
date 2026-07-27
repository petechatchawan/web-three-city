export type WebGL2Capability =
  | Readonly<{ supported: true; context: WebGL2RenderingContext }>
  | Readonly<{ supported: false; reason: 'webgl2-unavailable' }>;

export function detectWebGL2(canvas: HTMLCanvasElement): WebGL2Capability {
  try {
    const context = canvas.getContext('webgl2');
    return context === null
      ? { supported: false, reason: 'webgl2-unavailable' }
      : { supported: true, context };
  } catch {
    return { supported: false, reason: 'webgl2-unavailable' };
  }
}
