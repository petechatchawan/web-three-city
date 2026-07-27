import type { ViewportInsets } from '@web-three-city/camera-input';
import type { CellCoord } from '@web-three-city/world-core';

export type ControlsMode = 'expanded' | 'compact';
export type QualityLevel = 'low' | 'medium' | 'high';

export interface GameViewportLayout {
  readonly width: number;
  readonly height: number;
  readonly insets: ViewportInsets;
  readonly mode: ControlsMode;
}

export interface GameUi {
  readonly canvas: HTMLCanvasElement;
  readonly panel: HTMLElement;
  readonly status: HTMLElement;
  readonly qualitySelect: HTMLSelectElement;
  readonly saveButton: HTMLButtonElement;
  readonly loadButton: HTMLButtonElement;
  readonly rotateLeftButton: HTMLButtonElement;
  readonly rotateRightButton: HTMLButtonElement;
  readonly resetButton: HTMLButtonElement;
  readonly gridButton: HTMLButtonElement;
  measureViewport(): GameViewportLayout;
  setStatus(value: string): void;
  setQuality(value: string): void;
  setSelectedCell(cell: CellCoord | null): void;
  setGridVisible(visible: boolean): void;
  setControlsMode(mode: ControlsMode): void;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`game:missing-element:${selector}`);
  return element;
}

export function renderGameUi(root: HTMLElement): GameUi {
  root.innerHTML = `
    <main class="app-shell">
      <canvas id="game-canvas" aria-label="City terrain viewport"></canvas>
      <section class="panel" aria-label="Game controls" data-world-input-block>
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Web Three City</p>
            <h1>Coastal terrain</h1>
          </div>
          <span class="controls-mode" data-testid="controls-mode">expanded</span>
        </div>
        <div class="status-row">
          <span>Status</span>
          <strong data-testid="game-status">Loading</strong>
        </div>
        <div class="metrics-row">
          <span>Selected</span>
          <strong data-testid="selected-cell">None</strong>
        </div>
        <label class="field" for="quality-select">
          <span>Quality</span>
          <select id="quality-select" aria-label="Quality">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <p class="quality-value">Active quality: <strong data-testid="quality-value">Medium</strong></p>
        <div class="actions">
          <button type="button" data-action="save">Save terrain</button>
          <button type="button" data-action="load">Load terrain</button>
          <button type="button" data-action="rotate-left">Rotate left</button>
          <button type="button" data-action="rotate-right">Rotate right</button>
          <button type="button" data-action="reset">Reset camera</button>
          <button type="button" data-action="grid" aria-pressed="false">Grid</button>
        </div>
      </section>
    </main>
  `;

  const canvas = requireElement<HTMLCanvasElement>(root, '#game-canvas');
  const panel = requireElement<HTMLElement>(root, '.panel');
  const status = requireElement<HTMLElement>(root, '[data-testid="game-status"]');
  const qualityValue = requireElement<HTMLElement>(root, '[data-testid="quality-value"]');
  const selectedCell = requireElement<HTMLElement>(root, '[data-testid="selected-cell"]');
  const controlsMode = requireElement<HTMLElement>(root, '[data-testid="controls-mode"]');
  const qualitySelect = requireElement<HTMLSelectElement>(root, '#quality-select');
  const saveButton = requireElement<HTMLButtonElement>(root, '[data-action="save"]');
  const loadButton = requireElement<HTMLButtonElement>(root, '[data-action="load"]');
  const rotateLeftButton = requireElement<HTMLButtonElement>(root, '[data-action="rotate-left"]');
  const rotateRightButton = requireElement<HTMLButtonElement>(root, '[data-action="rotate-right"]');
  const resetButton = requireElement<HTMLButtonElement>(root, '[data-action="reset"]');
  const gridButton = requireElement<HTMLButtonElement>(root, '[data-action="grid"]');

  const ui: GameUi = {
    canvas,
    panel,
    status,
    qualitySelect,
    saveButton,
    loadButton,
    rotateLeftButton,
    rotateRightButton,
    resetButton,
    gridButton,
    measureViewport(): GameViewportLayout {
      const canvasRect = canvas.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const width = Math.max(1, canvas.clientWidth || canvasRect.width);
      const height = Math.max(1, canvas.clientHeight || canvasRect.height);
      const mode: ControlsMode = window.matchMedia('(max-width: 720px)').matches
        ? 'compact'
        : 'expanded';
      const insets: ViewportInsets =
        mode === 'compact'
          ? {
              top: Math.min(height - 1, Math.max(0, panelRect.bottom - canvasRect.top + 8)),
              right: 0,
              bottom: 0,
              left: 0,
            }
          : {
              top: 0,
              right: 0,
              bottom: 0,
              left: Math.min(width - 1, Math.max(0, panelRect.right - canvasRect.left + 16)),
            };
      return { width, height, insets, mode };
    },
    setStatus(value: string): void {
      status.textContent = value;
    },
    setQuality(value: string): void {
      qualityValue.textContent = value;
    },
    setSelectedCell(cell: CellCoord | null): void {
      selectedCell.textContent = cell === null ? 'None' : `${cell.x}, ${cell.z}`;
    },
    setGridVisible(visible: boolean): void {
      gridButton.setAttribute('aria-pressed', String(visible));
      gridButton.classList.toggle('is-active', visible);
    },
    setControlsMode(mode: ControlsMode): void {
      controlsMode.textContent = mode;
      panel.dataset.mode = mode;
    },
  };

  return ui;
}
