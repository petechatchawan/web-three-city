import type { ViewportInsets } from '@web-three-city/camera-input';

export type ControlsMode = 'expanded' | 'compact';
export type QualityLevel = 'low' | 'medium' | 'high';

export interface GameViewportLayout {
  readonly width: number;
  readonly height: number;
  readonly insets: ViewportInsets;
  readonly mode: ControlsMode;
}

/**
 * Slim adapter contract consumed by game bootstrap and main. M3 reduced the
 * legacy GameUi surface to the canvas host plus the status/undo feeds the shell
 * consumes; measureViewport serves the camera rig.
 */
export interface GameBootstrapHost {
  readonly canvas: HTMLCanvasElement;
  measureViewport(): GameViewportLayout;
  setStatus(value: string): void;
  setUndoAvailable(available: boolean): void;
  onStatus(listener: (value: string) => void): void;
  onUndoAvailable(listener: (available: boolean) => void): void;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`game:missing-element:${selector}`);
  return element;
}

/**
 * Mounts the full-bleed WebGL canvas only. The shell (`.city-ui`) owns every
 * other UI surface; main.ts subscribes the status/undo feeds to the shell tool
 * context sheet once it is mounted.
 */
export function renderGameCanvas(root: HTMLElement): GameBootstrapHost {
  root.innerHTML = `
    <main class="app-shell">
      <canvas id="game-canvas" aria-label="City terrain viewport"></canvas>
    </main>
  `;
  const canvas = requireElement<HTMLCanvasElement>(root, '#game-canvas');
  let statusFeed: (value: string) => void = () => undefined;
  let undoFeed: (available: boolean) => void = () => undefined;
  let lastStatus: string | null = null;
  let lastUndoAvailable: boolean | null = null;
  return {
    canvas,
    measureViewport(): GameViewportLayout {
      const canvasRect = canvas.getBoundingClientRect();
      const width = Math.max(1, canvas.clientWidth || canvasRect.width);
      const height = Math.max(1, canvas.clientHeight || canvasRect.height);
      const mode: ControlsMode = window.matchMedia('(max-width: 720px)').matches
        ? 'compact'
        : 'expanded';
      const insets: ViewportInsets = { top: 0, right: 0, bottom: 0, left: 0 };
      return { width, height, insets, mode };
    },
    setStatus(value: string): void {
      lastStatus = value;
      statusFeed(value);
    },
    setUndoAvailable(available: boolean): void {
      lastUndoAvailable = available;
      undoFeed(available);
    },
    onStatus(listener: (value: string) => void): void {
      statusFeed = listener;
      if (lastStatus !== null) listener(lastStatus);
    },
    onUndoAvailable(listener: (available: boolean) => void): void {
      undoFeed = listener;
      if (lastUndoAvailable !== null) listener(lastUndoAvailable);
    },
  };
}
