import type { GameToolMode } from './game-tool-mode.js';
import { bindGameToolEvents, type GameToolEventDetail } from './game-tool-events.js';
import { messageForGameReason } from './game-reason-catalog.js';
import type { ZoneToolMode } from './game-tool-mode.js';
import type { UiAdapter } from './ui/foundation/lifecycle.js';
import type { ContextualToolProjection } from './ui/shell/tool-context-sheet.js';

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

export function translateToolEvent(
  detail: GameToolEventDetail,
  prior: ContextualToolProjection | null = null,
): ContextualToolProjection | null {
  switch (detail.type) {
    case 'terraform-state': {
      const mode: GameToolMode = detail.state.operation ?? prior?.mode ?? 'navigate';
      if (
        detail.state.operation === null &&
        !detail.state.strokeActive &&
        detail.state.currentStamp.kind === 'none'
      ) {
        return null;
      }
      let status: string;
      let message: string;
      if (detail.state.currentStamp.kind === 'rejected') {
        status = 'Rejected';
        message = messageForGameReason(detail.state.currentStamp.reason);
      } else if (detail.state.currentStamp.kind === 'no-change') {
        status = 'No change';
        message = messageForGameReason('terraform:no-change');
      } else if (detail.state.currentStamp.kind === 'accepted') {
        status = 'Valid preview';
        message = 'Release to apply the accepted terrain change';
      } else {
        status = 'Previewing';
        message = prior?.message ?? 'Release to apply the previewed terrain change';
      }
      return {
        mode,
        name: toolLabel(mode),
        state: status,
        message,
        requestedCells: detail.state.acceptedAnchors.length,
        effectiveCells: detail.state.acceptedPlan?.supportCells.length ?? 0,
      };
    }
    case 'road-state': {
      const mode: GameToolMode = detail.state.mode ?? prior?.mode ?? 'navigate';
      let message: string;
      if (detail.reason !== null) {
        message = messageForGameReason(detail.reason);
      } else if (detail.state.strokeActive) {
        message =
          detail.state.mode === 'road-bulldoze'
            ? 'Release to remove the highlighted Road cells'
            : 'Release to build the highlighted Road cells';
      } else {
        message = 'Point at the world to preview this tool';
      }
      return {
        mode,
        name: toolLabel(mode),
        state: roadPreviewStateLabel(detail.state.mode, detail.state.previewValid),
        message,
        requestedCells: detail.state.previewCellCount,
        effectiveCells: detail.state.previewValid === true ? detail.state.previewCellCount : 0,
      };
    }
    case 'zone-state': {
      const mode: GameToolMode = detail.state.mode ?? prior?.mode ?? 'navigate';
      let message: string;
      if (detail.reason !== null) {
        message = messageForGameReason(detail.reason);
      } else if (detail.state.strokeActive) {
        message =
          detail.state.mode === 'zone-remove'
            ? 'Release to remove the highlighted Zone cells'
            : 'Release to paint the highlighted Zone cells';
      } else {
        message = 'Point at the world to preview this tool';
      }
      return {
        mode,
        name: toolLabel(mode),
        state: zonePreviewStateLabel(detail.state.mode, detail.state.previewValid),
        message,
        requestedCells: detail.state.previewCellCount,
        effectiveCells: detail.effectiveCellCount,
      };
    }
    case 'reason': {
      const mode: GameToolMode = prior?.mode ?? 'navigate';
      return {
        mode,
        name: toolLabel(mode),
        state: detail.reason.endsWith(':no-change') ? 'No change' : 'Rejected',
        message: messageForGameReason(detail.reason),
        ...(prior?.requestedCells !== undefined ? { requestedCells: prior.requestedCells } : {}),
        ...(prior?.effectiveCells !== undefined ? { effectiveCells: prior.effectiveCells } : {}),
      };
    }
    case 'transaction-state': {
      const mode: GameToolMode = prior?.mode ?? 'navigate';
      const domain = domainLabel(detail.domain);
      const state = detail.state === 'committing' ? 'Applying change' : 'Undoing';
      const message =
        detail.state === 'committing'
          ? `Applying ${domain} change…`
          : `Restoring previous ${domain} state…`;
      return {
        mode,
        name: toolLabel(mode),
        state,
        message,
      };
    }
    default: {
      const exhaustive: never = detail;
      throw new Error(`Unhandled tool event detail: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function bindGameToolContext(
  target: EventTarget,
  sheet: Pick<UiAdapter<ContextualToolProjection>, 'update'>,
  signal?: AbortSignal,
): void {
  let prior: ContextualToolProjection | null = null;
  bindGameToolEvents(
    target,
    (detail) => {
      const projection = translateToolEvent(detail, prior);
      if (projection === null) {
        return;
      }
      prior = projection;
      sheet.update(projection);
    },
    signal,
  );
}

export function toolLabel(mode: GameToolMode): string {
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

function domainLabel(domain: 'terraform' | 'road' | 'zone' | 'building'): string {
  switch (domain) {
    case 'terraform':
      return 'Terrain';
    case 'road':
      return 'Road';
    case 'zone':
      return 'Zone';
    case 'building':
      return 'Building';
  }
}
