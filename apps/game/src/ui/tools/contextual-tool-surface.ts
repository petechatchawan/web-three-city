import type { GameToolMode } from '../../game-tool-mode.js';
import type { UiAdapter } from '../foundation/lifecycle.js';

export interface ContextualToolProjection {
  readonly mode: GameToolMode;
  readonly name: string;
  readonly state: string;
  readonly message: string;
  readonly requestedCells?: number;
  readonly effectiveCells?: number;
  readonly affordability?: 'Affordable' | 'Unaffordable';
  readonly undoAvailable: boolean;
}

export function mountContextualToolSurface(
  parent: HTMLElement,
): UiAdapter<ContextualToolProjection> {
  const element = document.createElement('section');
  element.className = 'city-tool-context';
  element.setAttribute('aria-label', 'Active tool');
  parent.append(element);
  return Object.freeze({
    element,
    update(projection: ContextualToolProjection): void {
      const parts = [projection.name, projection.state, projection.message];
      if (projection.requestedCells !== undefined) parts.push(`${projection.requestedCells} cells`);
      if (projection.effectiveCells !== undefined)
        parts.push(`${projection.effectiveCells} effective`);
      if (projection.affordability !== undefined) parts.push(projection.affordability);
      parts.push(projection.undoAvailable ? 'Undo available' : 'Undo unavailable');
      element.replaceChildren(
        ...parts.map((text) =>
          Object.assign(document.createElement('span'), { textContent: text }),
        ),
      );
    },
    dispose(): void {
      element.remove();
    },
  });
}
