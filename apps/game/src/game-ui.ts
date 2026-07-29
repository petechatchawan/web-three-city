import type { ViewportInsets } from '@web-three-city/camera-input';
import type { TerraformBrushSize } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';
import { isRoadToolMode, type GameToolMode } from './game-tool-mode.js';

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
  readonly navigateButton: HTMLButtonElement;
  readonly raiseButton: HTMLButtonElement;
  readonly lowerButton: HTMLButtonElement;
  readonly flattenButton: HTMLButtonElement;
  readonly roadBuildButton: HTMLButtonElement;
  readonly roadBulldozeButton: HTMLButtonElement;
  readonly brushControls: HTMLElement;
  readonly brush1Button: HTMLButtonElement;
  readonly brush3Button: HTMLButtonElement;
  readonly brush5Button: HTMLButtonElement;
  readonly undoButton: HTMLButtonElement;
  measureViewport(): GameViewportLayout;
  setStatus(value: string): void;
  setQuality(value: string): void;
  setSelectedCell(cell: CellCoord | null): void;
  setGridVisible(visible: boolean): void;
  setControlsMode(mode: ControlsMode): void;
  setToolMode(mode: GameToolMode): void;
  setBrushSize(size: TerraformBrushSize): void;
  setUndoAvailable(available: boolean): void;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`game:missing-element:${selector}`);
  return element;
}

function setPressed(button: HTMLButtonElement, pressed: boolean): void {
  button.setAttribute('aria-pressed', String(pressed));
  button.classList.toggle('is-active', pressed);
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
        <div class="metrics-grid">
          <div class="metrics-row">
            <span>Selected</span>
            <strong data-testid="selected-cell">None</strong>
          </div>
          <div class="metrics-row">
            <span>Tool</span>
            <strong data-testid="active-tool">Navigate</strong>
          </div>
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
        <div class="control-group">
          <p class="control-label">World tool</p>
          <div class="actions world-tools">
            <button type="button" data-action="tool-navigate" aria-pressed="true">Navigate</button>
            <button type="button" data-action="tool-raise" aria-pressed="false">Raise</button>
            <button type="button" data-action="tool-lower" aria-pressed="false">Lower</button>
            <button type="button" data-action="tool-flatten" aria-pressed="false">Flatten</button>
            <button type="button" data-action="tool-road-build" aria-pressed="false">Build Road</button>
            <button type="button" data-action="tool-road-bulldoze" aria-pressed="false">Bulldoze Road</button>
          </div>
        </div>
        <div class="control-group brush-row">
          <div data-testid="terraform-brush-controls">
            <p class="control-label">Terraform brush</p>
            <div class="actions terraform-brushes">
              <button type="button" data-action="brush-1" aria-label="Brush 1 × 1" aria-pressed="true">1 × 1</button>
              <button type="button" data-action="brush-3" aria-label="Brush 3 × 3" aria-pressed="false">3 × 3</button>
              <button type="button" data-action="brush-5" aria-label="Brush 5 × 5" aria-pressed="false">5 × 5</button>
            </div>
          </div>
          <button type="button" class="undo-button" data-action="undo" aria-label="Undo latest world change" disabled>Undo</button>
        </div>
        <div class="actions world-actions">
          <button type="button" data-action="save">Save world</button>
          <button type="button" data-action="load">Load world</button>
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
  const activeTool = requireElement<HTMLElement>(root, '[data-testid="active-tool"]');
  const controlsMode = requireElement<HTMLElement>(root, '[data-testid="controls-mode"]');
  const qualitySelect = requireElement<HTMLSelectElement>(root, '#quality-select');
  const saveButton = requireElement<HTMLButtonElement>(root, '[data-action="save"]');
  const loadButton = requireElement<HTMLButtonElement>(root, '[data-action="load"]');
  const rotateLeftButton = requireElement<HTMLButtonElement>(root, '[data-action="rotate-left"]');
  const rotateRightButton = requireElement<HTMLButtonElement>(root, '[data-action="rotate-right"]');
  const resetButton = requireElement<HTMLButtonElement>(root, '[data-action="reset"]');
  const gridButton = requireElement<HTMLButtonElement>(root, '[data-action="grid"]');
  const navigateButton = requireElement<HTMLButtonElement>(root, '[data-action="tool-navigate"]');
  const raiseButton = requireElement<HTMLButtonElement>(root, '[data-action="tool-raise"]');
  const lowerButton = requireElement<HTMLButtonElement>(root, '[data-action="tool-lower"]');
  const flattenButton = requireElement<HTMLButtonElement>(root, '[data-action="tool-flatten"]');
  const roadBuildButton = requireElement<HTMLButtonElement>(root, '[data-action="tool-road-build"]');
  const roadBulldozeButton = requireElement<HTMLButtonElement>(
    root,
    '[data-action="tool-road-bulldoze"]',
  );
  const brushControls = requireElement<HTMLElement>(root, '[data-testid="terraform-brush-controls"]');
  const brush1Button = requireElement<HTMLButtonElement>(root, '[data-action="brush-1"]');
  const brush3Button = requireElement<HTMLButtonElement>(root, '[data-action="brush-3"]');
  const brush5Button = requireElement<HTMLButtonElement>(root, '[data-action="brush-5"]');
  const undoButton = requireElement<HTMLButtonElement>(root, '[data-action="undo"]');
  const toolButtons: Readonly<Record<GameToolMode, HTMLButtonElement>> = {
    navigate: navigateButton,
    raise: raiseButton,
    lower: lowerButton,
    flatten: flattenButton,
    'road-build': roadBuildButton,
    'road-bulldoze': roadBulldozeButton,
  };
  const brushButtons: Readonly<Record<TerraformBrushSize, HTMLButtonElement>> = {
    1: brush1Button,
    3: brush3Button,
    5: brush5Button,
  };
  const toolLabels: Readonly<Record<GameToolMode, string>> = {
    navigate: 'Navigate',
    raise: 'Raise',
    lower: 'Lower',
    flatten: 'Flatten',
    'road-build': 'Build Road',
    'road-bulldoze': 'Bulldoze Road',
  };

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
    navigateButton,
    raiseButton,
    lowerButton,
    flattenButton,
    roadBuildButton,
    roadBulldozeButton,
    brushControls,
    brush1Button,
    brush3Button,
    brush5Button,
    undoButton,
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
      setPressed(gridButton, visible);
    },
    setControlsMode(mode: ControlsMode): void {
      controlsMode.textContent = mode;
      panel.dataset.mode = mode;
    },
    setToolMode(mode: GameToolMode): void {
      activeTool.textContent = toolLabels[mode];
      for (const [candidate, button] of Object.entries(toolButtons)) {
        setPressed(button, candidate === mode);
      }
      const roadMode = isRoadToolMode(mode);
      brushControls.hidden = roadMode;
      for (const button of Object.values(brushButtons)) button.disabled = roadMode;
    },
    setBrushSize(size: TerraformBrushSize): void {
      for (const [candidate, button] of Object.entries(brushButtons)) {
        setPressed(button, Number(candidate) === size);
      }
    },
    setUndoAvailable(available: boolean): void {
      undoButton.disabled = !available;
    },
  };

  return ui;
}
