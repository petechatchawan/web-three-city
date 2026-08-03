import { bindGameToolEvents, dispatchGameToolCancel } from './game-tool-events.js';
import { messageForGameReason } from './game-reason-catalog.js';
import type { ZoneToolMode } from './game-tool-mode.js';

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`game-tool-hud:missing-element:${selector}`);
  return element;
}

function recoveryStatus(value: string): boolean {
  return /failed|context lost|unavailable/i.test(value);
}

function assertNever(value: never): never {
  throw new Error(`game-tool-hud:unknown-event:${JSON.stringify(value)}`);
}

export function roadPreviewStateLabel(
  mode: 'road-build' | 'road-bulldoze' | null,
  previewValid: boolean | null,
): string {
  if (previewValid === null) return 'Tool ready';
  const operation = mode === 'road-bulldoze' ? 'bulldoze' : 'build';
  return `${previewValid ? 'Valid' : 'Invalid'} ${operation}`;
}

export function zonePreviewStateLabel(
  mode: ZoneToolMode | null,
  previewValid: boolean | null,
): string {
  if (previewValid === null) return 'Tool ready';
  const operation = mode === 'zone-remove' ? 'removal' : 'paint';
  return `${previewValid ? 'Valid' : 'Invalid'} ${operation}`;
}

export function bindGameToolHud(
  root: ParentNode,
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
): void {
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
  const status = requireElement<HTMLElement>(root, '[data-testid="game-status"]');
  const navigateButton = requireElement<HTMLButtonElement>(root, '[data-action="tool-navigate"]');
  const mutationButtons = [
    '[data-action="tool-raise"]',
    '[data-action="tool-lower"]',
    '[data-action="tool-flatten"]',
    '[data-action="tool-road-build"]',
    '[data-action="tool-road-bulldoze"]',
    '[data-action="tool-zone-residential"]',
    '[data-action="tool-zone-commercial"]',
    '[data-action="tool-zone-industrial"]',
    '[data-action="tool-zone-remove"]',
    '[data-action="tool-building-develop"]',
    '[data-action="tool-building-bulldoze"]',
  ].map((selector) => requireElement<HTMLButtonElement>(root, selector));
  const undoButton = requireElement<HTMLButtonElement>(root, '[data-action="undo"]');
  let interactionActive = false;
  let suppressedStatusMutations = 0;

  const hideMetrics = (): void => {
    terraformMetrics.hidden = true;
    roadMetrics.hidden = true;
    zoneMetrics.hidden = true;
  };

  const setCompatibilityStatus = (value: string): void => {
    suppressedStatusMutations += 1;
    status.textContent = value;
  };

  const setMutationBlocked = (blocked: boolean): void => {
    for (const button of mutationButtons) button.disabled = blocked;
    if (blocked) undoButton.disabled = true;
  };

  bindGameToolEvents(
    canvas,
    (detail) => {
      switch (detail.type) {
        case 'terraform-state': {
          const state = detail.state;
          interactionActive = state.strokeActive;
          terraformMetrics.hidden = false;
          roadMetrics.hidden = true;
          zoneMetrics.hidden = true;
          terraformAccepted.textContent = String(state.acceptedAnchors.length);
          terraformSupport.textContent = String(state.acceptedPlan?.supportCells.length ?? 0);
          terraformTarget.textContent =
            state.flattenTargetLevel === null ? '—' : String(state.flattenTargetLevel);
          if (state.currentStamp.kind === 'rejected') {
            contextState.textContent = 'Rejected';
            contextMessage.textContent = messageForGameReason(state.currentStamp.reason);
          } else if (state.currentStamp.kind === 'no-change') {
            contextState.textContent = 'No change';
            contextMessage.textContent = messageForGameReason('terraform:no-change');
          } else if (state.currentStamp.kind === 'accepted') {
            contextState.textContent = 'Valid preview';
            contextMessage.textContent = 'Release to apply the accepted terrain change';
          } else if (state.strokeActive) {
            contextState.textContent = 'Previewing';
          }
          break;
        }
        case 'road-state':
          interactionActive = detail.state.strokeActive;
          terraformMetrics.hidden = true;
          roadMetrics.hidden = false;
          zoneMetrics.hidden = true;
          roadRequested.textContent = String(detail.state.previewCellCount);
          roadEffective.textContent = String(
            detail.state.previewValid === true ? detail.state.previewCellCount : 0,
          );
          contextState.textContent = roadPreviewStateLabel(
            detail.state.mode,
            detail.state.previewValid,
          );
          if (detail.reason !== null) {
            contextMessage.textContent = messageForGameReason(detail.reason);
          } else if (detail.state.strokeActive) {
            contextMessage.textContent =
              detail.state.mode === 'road-bulldoze'
                ? 'Release to remove the highlighted Road cells'
                : 'Release to build the highlighted Road cells';
          }
          break;
        case 'zone-state':
          interactionActive = detail.state.strokeActive;
          terraformMetrics.hidden = true;
          roadMetrics.hidden = true;
          zoneMetrics.hidden = false;
          zoneRequested.textContent = String(detail.state.previewCellCount);
          zoneEffective.textContent = String(detail.effectiveCellCount);
          zoneInvalid.textContent = String(detail.invalidCellCount);
          contextState.textContent = zonePreviewStateLabel(
            detail.state.mode,
            detail.state.previewValid,
          );
          if (detail.reason !== null) {
            contextMessage.textContent = messageForGameReason(detail.reason);
          } else if (detail.state.strokeActive) {
            contextMessage.textContent =
              detail.state.mode === 'zone-remove'
                ? 'Release to remove the highlighted Zone cells'
                : 'Release to paint the highlighted Zone cells';
          }
          break;
        case 'reason':
          interactionActive = false;
          contextState.textContent = detail.reason.endsWith(':no-change')
            ? 'No change'
            : 'Rejected';
          contextMessage.textContent = messageForGameReason(detail.reason);
          if (detail.reason === 'terraform:road-occupied') {
            setCompatibilityStatus('Terraform blocked by road');
          } else if (detail.reason === 'terraform:building-occupied') {
            setCompatibilityStatus('Terraform blocked by building');
          } else if (detail.reason === 'terraform:zone-occupied') {
            setCompatibilityStatus('Terraform blocked by zone');
          } else if (detail.reason === 'terraform:no-change') {
            setCompatibilityStatus('Terraform unchanged');
          } else if (detail.reason.startsWith('terraform:')) {
            setCompatibilityStatus('Terraform rejected');
          }
          break;
        case 'transaction-state': {
          interactionActive = false;
          hideMetrics();
          setMutationBlocked(true);
          const domain =
            detail.domain === 'terraform'
              ? 'Terrain'
              : detail.domain === 'road'
                ? 'Road'
                : detail.domain === 'zone'
                  ? 'Zone'
                  : 'Building';
          if (detail.state === 'committing') {
            contextState.textContent = 'Applying change';
            contextMessage.textContent = `Applying ${domain} change…`;
          } else {
            contextState.textContent = 'Undoing';
            contextMessage.textContent = `Restoring previous ${domain} state…`;
          }
          break;
        }
        default:
          assertNever(detail);
      }
    },
    signal,
  );

  const observer = new MutationObserver(() => {
    if (suppressedStatusMutations > 0) {
      suppressedStatusMutations -= 1;
      return;
    }
    if (interactionActive) return;
    const value = status.textContent?.trim();
    if (value === undefined || value.length === 0 || value === 'Loading') return;
    const blocked = recoveryStatus(value);
    hideMetrics();
    setMutationBlocked(blocked);
    if (blocked) {
      dispatchGameToolCancel(canvas);
      navigateButton.click();
    }
    contextState.textContent = blocked ? 'Recovery required' : 'Ready';
    contextMessage.textContent = value;
  });
  observer.observe(status, { childList: true, characterData: true, subtree: true });
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
}
