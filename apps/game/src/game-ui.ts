import type { ViewportInsets } from '@web-three-city/camera-input';
import type { TerraformBrushSize } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';
import type { ZoneCounts } from '@web-three-city/zone-core';
import {
  initialGameToolPresentationState,
  reduceGameToolPresentation,
  type GameToolPresentationState,
} from './game-tool-presentation.js';
import {
  isRoadToolMode,
  isTerraformToolMode,
  isZoneToolMode,
  type GameToolMode,
} from './game-tool-mode.js';
import { messageForGameReason } from './game-reason-catalog.js';

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
  readonly zoneResidentialButton: HTMLButtonElement;
  readonly zoneCommercialButton: HTMLButtonElement;
  readonly zoneIndustrialButton: HTMLButtonElement;
  readonly zoneRemoveButton: HTMLButtonElement;
  readonly buildingBulldozeButton: HTMLButtonElement;
  readonly closeToolButton: HTMLButtonElement;
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
  setZoneCounts(counts: ZoneCounts): void;
  setBuildingCount(count: number): void;
  renderToolPresentation(state: GameToolPresentationState): void;
  setSecondaryControlsExpanded(expanded: boolean): void;
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

function toolLabel(mode: GameToolMode): string {
  switch (mode) {
    case 'navigate':
      return 'Navigate';
    case 'raise':
      return 'Raise';
    case 'lower':
      return 'Lower';
    case 'flatten':
      return 'Flatten';
    case 'road-build':
      return 'Build Road';
    case 'road-bulldoze':
      return 'Bulldoze Road';
    case 'zone-residential':
      return 'Residential Zone';
    case 'zone-commercial':
      return 'Commercial Zone';
    case 'zone-industrial':
      return 'Industrial Zone';
    case 'zone-remove':
      return 'Remove Zone';
    case 'building-bulldoze':
      return 'Bulldoze Building';
  }
}

export function renderGameUi(root: HTMLElement): GameUi {
  root.innerHTML = `
    <main class="app-shell">
      <canvas id="game-canvas" aria-label="City terrain viewport"></canvas>
      <section class="panel game-hud" aria-label="Game controls" data-world-input-block>
        <header class="hud-heading">
          <div>
            <p class="eyebrow">Web Three City</p>
            <h1>Coastal terrain</h1>
          </div>
          <span class="controls-mode" data-testid="controls-mode">expanded</span>
        </header>

        <div class="primary-workspace">
          <section class="primary-tool-surface" aria-label="Legacy world tools" hidden>
            <p class="control-label">World tools</p>
            <div class="world-tools">
              <button type="button" data-action="tool-navigate" aria-pressed="true">Navigate</button>
              <button type="button" data-action="tool-raise" aria-pressed="false">Raise</button>
              <button type="button" data-action="tool-lower" aria-pressed="false">Lower</button>
              <button type="button" data-action="tool-flatten" aria-pressed="false">Flatten</button>
              <button type="button" data-action="tool-road-build" aria-pressed="false">Build Road</button>
              <button type="button" data-action="tool-road-bulldoze" aria-pressed="false">Bulldoze Road</button>
              <button type="button" data-action="tool-zone-residential" aria-pressed="false">Residential</button>
              <button type="button" data-action="tool-zone-commercial" aria-pressed="false">Commercial</button>
              <button type="button" data-action="tool-zone-industrial" aria-pressed="false">Industrial</button>
              <button type="button" data-action="tool-zone-remove" aria-pressed="false">Remove Zone</button>
              <button type="button" data-action="tool-building-bulldoze" aria-label="Bulldoze Building" aria-pressed="false">Bulldoze Building</button>
              <button type="button" class="tool-close" data-action="tool-close" data-testid="tool-close">Close tool</button>
            </div>
            <div class="terraform-brush" data-testid="terraform-brush-controls" hidden>
              <p class="control-label">Terraform brush</p>
              <div class="terraform-brushes">
                <button type="button" data-action="brush-1" aria-label="Brush 1 × 1" aria-pressed="true">1 × 1</button>
                <button type="button" data-action="brush-3" aria-label="Brush 3 × 3" aria-pressed="false">3 × 3</button>
                <button type="button" data-action="brush-5" aria-label="Brush 5 × 5" aria-pressed="false">5 × 5</button>
              </div>
            </div>
          </section>

          <section class="tool-context" data-testid="tool-context" aria-live="polite">
            <div class="context-heading">
              <span>Tool</span>
              <strong data-testid="active-tool">Navigate</strong>
            </div>
            <strong class="context-state" data-testid="tool-context-state">Camera ready</strong>
            <p class="context-message" data-testid="tool-context-message">Drag to pan, use the wheel to zoom.</p>
            <div class="context-metrics terraform-context-metrics" hidden>
              <span>Accepted <strong data-testid="terraform-accepted-count">0</strong></span>
              <span>Support <strong data-testid="terraform-support-count">0</strong></span>
              <span>Target <strong data-testid="terraform-flatten-target">—</strong></span>
            </div>
            <div class="context-metrics road-context-metrics" hidden>
              <span>Requested <strong data-testid="road-requested-count">0</strong></span>
              <span>Effective <strong data-testid="road-effective-count">0</strong></span>
            </div>
            <div class="context-metrics zone-context-metrics" hidden>
              <span>Requested <strong data-testid="zone-requested-count">0</strong></span>
              <span>Effective <strong data-testid="zone-effective-count">0</strong></span>
              <span>Invalid <strong data-testid="zone-invalid-count">0</strong></span>
            </div>
          </section>

          <button type="button" class="undo-button" data-action="undo" data-testid="undo-world-change" aria-label="Undo latest world change" disabled>Undo</button>
        </div>

        <details class="secondary-controls" data-testid="secondary-controls">
          <summary>World and camera controls</summary>
          <div class="secondary-content">
            <div class="status-row">
              <span>Status</span>
              <strong data-testid="game-status">Loading</strong>
            </div>
            <div class="metrics-grid">
              <div class="metrics-row">
                <span>Selected</span>
                <strong data-testid="selected-cell">None</strong>
              </div>
              <div class="metrics-row"><span>Buildings</span><strong data-testid="building-count">0</strong></div>
              <div class="metrics-row zone-counts" aria-label="Committed zone counts">
                <span>Zones</span>
                <strong>
                  R <span data-testid="zone-residential-count">0</span>
                  C <span data-testid="zone-commercial-count">0</span>
                  I <span data-testid="zone-industrial-count">0</span>
                </strong>
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
            <div class="world-actions">
              <button type="button" data-action="save">Save world</button>
              <button type="button" data-action="load">Load world</button>
              <button type="button" data-action="rotate-left">Rotate left</button>
              <button type="button" data-action="rotate-right">Rotate right</button>
              <button type="button" data-action="reset">Reset camera</button>
              <button type="button" data-action="grid" aria-pressed="false">Grid</button>
            </div>
          </div>
        </details>
      </section>
    </main>
  `;

  const canvas = requireElement<HTMLCanvasElement>(root, '#game-canvas');
  const panel = requireElement<HTMLElement>(root, '.panel');
  const status = requireElement<HTMLElement>(root, '[data-testid="game-status"]');
  const qualityValue = requireElement<HTMLElement>(root, '[data-testid="quality-value"]');
  const selectedCell = requireElement<HTMLElement>(root, '[data-testid="selected-cell"]');
  const activeTool = requireElement<HTMLElement>(root, '[data-testid="active-tool"]');
  const contextState = requireElement<HTMLElement>(root, '[data-testid="tool-context-state"]');
  const contextMessage = requireElement<HTMLElement>(root, '[data-testid="tool-context-message"]');
  const terraformMetrics = requireElement<HTMLElement>(root, '.terraform-context-metrics');
  const roadMetrics = requireElement<HTMLElement>(root, '.road-context-metrics');
  const zoneMetrics = requireElement<HTMLElement>(root, '.zone-context-metrics');
  const terraformAccepted = requireElement<HTMLElement>(
    root,
    '[data-testid="terraform-accepted-count"]',
  );
  const terraformSupport = requireElement<HTMLElement>(
    root,
    '[data-testid="terraform-support-count"]',
  );
  const terraformTarget = requireElement<HTMLElement>(
    root,
    '[data-testid="terraform-flatten-target"]',
  );
  const roadRequested = requireElement<HTMLElement>(root, '[data-testid="road-requested-count"]');
  const roadEffective = requireElement<HTMLElement>(root, '[data-testid="road-effective-count"]');
  const zoneRequested = requireElement<HTMLElement>(root, '[data-testid="zone-requested-count"]');
  const zoneEffective = requireElement<HTMLElement>(root, '[data-testid="zone-effective-count"]');
  const zoneInvalid = requireElement<HTMLElement>(root, '[data-testid="zone-invalid-count"]');
  const zoneResidentialCount = requireElement<HTMLElement>(
    root,
    '[data-testid="zone-residential-count"]',
  );
  const zoneCommercialCount = requireElement<HTMLElement>(
    root,
    '[data-testid="zone-commercial-count"]',
  );
  const zoneIndustrialCount = requireElement<HTMLElement>(
    root,
    '[data-testid="zone-industrial-count"]',
  );
  const buildingCountValue = requireElement<HTMLElement>(root, '[data-testid="building-count"]');
  const controlsMode = requireElement<HTMLElement>(root, '[data-testid="controls-mode"]');
  const secondaryControls = requireElement<HTMLDetailsElement>(root, '.secondary-controls');
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
  const roadBuildButton = requireElement<HTMLButtonElement>(
    root,
    '[data-action="tool-road-build"]',
  );
  const roadBulldozeButton = requireElement<HTMLButtonElement>(
    root,
    '[data-action="tool-road-bulldoze"]',
  );
  const zoneResidentialButton = requireElement<HTMLButtonElement>(
    root,
    '[data-action="tool-zone-residential"]',
  );
  const zoneCommercialButton = requireElement<HTMLButtonElement>(
    root,
    '[data-action="tool-zone-commercial"]',
  );
  const zoneIndustrialButton = requireElement<HTMLButtonElement>(
    root,
    '[data-action="tool-zone-industrial"]',
  );
  const zoneRemoveButton = requireElement<HTMLButtonElement>(
    root,
    '[data-action="tool-zone-remove"]',
  );
  const buildingBulldozeButton = requireElement<HTMLButtonElement>(
    root,
    '[data-action="tool-building-bulldoze"]',
  );
  const closeToolButton = requireElement<HTMLButtonElement>(root, '[data-action="tool-close"]');
  const brushControls = requireElement<HTMLElement>(
    root,
    '[data-testid="terraform-brush-controls"]',
  );
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
    'zone-residential': zoneResidentialButton,
    'zone-commercial': zoneCommercialButton,
    'zone-industrial': zoneIndustrialButton,
    'zone-remove': zoneRemoveButton,
    'building-bulldoze': buildingBulldozeButton,
  };
  const brushButtons: Readonly<Record<TerraformBrushSize, HTMLButtonElement>> = {
    1: brush1Button,
    3: brush3Button,
    5: brush5Button,
  };
  let presentation = initialGameToolPresentationState();

  const renderToolPresentation = (state: GameToolPresentationState): void => {
    presentation = state;
    activeTool.textContent = toolLabel(state.mode);
    for (const [candidate, button] of Object.entries(toolButtons)) {
      setPressed(button, candidate === state.mode);
    }
    for (const [candidate, button] of Object.entries(brushButtons)) {
      setPressed(button, Number(candidate) === state.storedTerraformBrush);
    }

    const terraformMode = isTerraformToolMode(state.mode);
    brushControls.hidden = !terraformMode;
    for (const button of Object.values(brushButtons)) button.disabled = !terraformMode;
    closeToolButton.disabled = state.mode === 'navigate';
    terraformMetrics.hidden = true;
    roadMetrics.hidden = true;
    zoneMetrics.hidden = true;
    terraformAccepted.textContent = '0';
    terraformSupport.textContent = '0';
    terraformTarget.textContent = '—';
    roadRequested.textContent = '0';
    roadEffective.textContent = '0';
    zoneRequested.textContent = '0';
    zoneEffective.textContent = '0';
    zoneInvalid.textContent = '0';

    let stateLabel = state.mode === 'navigate' ? 'Camera ready' : 'Tool ready';
    let message = state.primaryMessage;
    if (state.interaction.kind === 'terraform') {
      const terraform = state.interaction.state;
      terraformMetrics.hidden = false;
      terraformAccepted.textContent = String(terraform.acceptedAnchors.length);
      terraformSupport.textContent = String(terraform.acceptedPlan?.supportCells.length ?? 0);
      terraformTarget.textContent =
        terraform.flattenTargetLevel === null ? '—' : String(terraform.flattenTargetLevel);
      if (terraform.currentStamp.kind === 'rejected') {
        stateLabel = 'Rejected';
        message ??= messageForGameReason(terraform.currentStamp.reason);
      } else if (terraform.currentStamp.kind === 'no-change') {
        stateLabel = 'No change';
        message ??= messageForGameReason('terraform:no-change');
      } else if (terraform.currentStamp.kind === 'accepted') {
        stateLabel = 'Valid preview';
        message ??= 'Release to apply the accepted terrain change';
      } else {
        stateLabel = terraform.strokeActive ? 'Previewing' : 'Tool ready';
      }
    } else if (state.interaction.kind === 'road') {
      roadMetrics.hidden = false;
      roadRequested.textContent = String(state.interaction.state.previewCellCount);
      roadEffective.textContent = String(
        state.interaction.state.previewValid === true
          ? state.interaction.state.previewCellCount
          : 0,
      );
      stateLabel =
        state.interaction.state.previewValid === true
          ? 'Valid preview'
          : state.interaction.state.previewValid === false
            ? 'Rejected'
            : 'Tool ready';
      if (state.interaction.reason !== null) {
        message ??= messageForGameReason(state.interaction.reason);
      }
    } else if (state.interaction.kind === 'zone') {
      zoneMetrics.hidden = false;
      zoneRequested.textContent = String(state.interaction.state.previewCellCount);
      zoneEffective.textContent = String(state.interaction.effectiveCellCount);
      zoneInvalid.textContent = String(state.interaction.invalidCellCount);
      stateLabel =
        state.interaction.state.previewValid === true
          ? 'Valid preview'
          : state.interaction.state.previewValid === false
            ? 'Rejected'
            : 'Tool ready';
      if (state.interaction.reason !== null) {
        message ??= messageForGameReason(state.interaction.reason);
      }
    } else if (state.interaction.kind === 'committing') {
      stateLabel = 'Applying change';
      const domain =
        state.interaction.domain === 'terraform'
          ? 'Terrain'
          : state.interaction.domain === 'road'
            ? 'Road'
            : state.interaction.domain === 'zone'
              ? 'Zone'
              : 'Building';
      message ??= `Applying ${domain} change…`;
    } else if (state.interaction.kind === 'undoing') {
      stateLabel = 'Undoing';
      message ??= 'Restoring the previous world state…';
    } else if (state.interaction.kind === 'blocking-recovery') {
      stateLabel = 'Recovery required';
      message = state.interaction.message;
    }

    if (message === null) {
      message =
        state.mode === 'navigate'
          ? 'Drag to pan, use the wheel to zoom.'
          : isRoadToolMode(state.mode)
            ? 'Drag a cardinal Road path and release to apply it.'
            : isZoneToolMode(state.mode)
              ? state.mode === 'zone-remove'
                ? 'Drag across Zone cells and release to remove them.'
                : 'Drag across eligible cells and release to paint the Zone.'
              : state.mode === 'building-bulldoze'
                ? 'Release on a Building footprint to bulldoze that Building.'
                : 'Drag across Terrain and release to apply accepted stamps.';
    }
    contextState.textContent = stateLabel;
    contextMessage.textContent = message;
    const busy =
      state.interaction.kind === 'committing' ||
      state.interaction.kind === 'undoing' ||
      state.interaction.kind === 'blocking-recovery';
    undoButton.disabled = !state.undoAvailable || busy;
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
    zoneResidentialButton,
    zoneCommercialButton,
    zoneIndustrialButton,
    zoneRemoveButton,
    buildingBulldozeButton,
    closeToolButton,
    brushControls,
    brush1Button,
    brush3Button,
    brush5Button,
    undoButton,
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
      renderToolPresentation(
        reduceGameToolPresentation(presentation, { type: 'select-tool', mode }),
      );
    },
    setBrushSize(size: TerraformBrushSize): void {
      renderToolPresentation(
        reduceGameToolPresentation(presentation, { type: 'select-brush', size }),
      );
    },
    setUndoAvailable(available: boolean): void {
      renderToolPresentation(
        reduceGameToolPresentation(presentation, {
          type: 'set-undo-available',
          available,
        }),
      );
    },
    setZoneCounts(counts: ZoneCounts): void {
      zoneResidentialCount.textContent = String(counts.residential);
      zoneCommercialCount.textContent = String(counts.commercial);
      zoneIndustrialCount.textContent = String(counts.industrial);
    },
    setBuildingCount(count: number): void {
      buildingCountValue.textContent = String(count);
    },
    renderToolPresentation,
    setSecondaryControlsExpanded(expanded: boolean): void {
      secondaryControls.open = expanded;
    },
  };

  renderToolPresentation(presentation);
  return ui;
}
