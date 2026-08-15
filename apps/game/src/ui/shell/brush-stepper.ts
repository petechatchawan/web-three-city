import { createButton } from '../components/button.js';

export const brushSizes = [1, 3, 5] as const;

export interface BrushSelector {
  readonly element: HTMLElement;
  setBrush(size: 1 | 3 | 5): void;
  dispose(): void;
}

export function mountBrushSelector(
  parent: HTMLElement,
  onBrush: (size: 1 | 3 | 5) => void,
): BrushSelector {
  const element = document.createElement('div');
  element.className = 'city-brush-stepper city-segment-group';
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', 'Terraform brush size');
  let activeBrush: 1 | 3 | 5 = 1;

  const renderPressed = (): void => {
    for (const button of element.querySelectorAll<HTMLButtonElement>('[data-brush-size]')) {
      const selected = Number(button.dataset.brushSize) === activeBrush;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-active', selected);
    }
  };

  for (const size of brushSizes) {
    const button = createButton(`${size} × ${size}`, () => {
      activeBrush = size;
      onBrush(size);
      renderPressed();
    });
    button.className = 'city-segment';
    button.setAttribute('aria-label', `Brush ${size} × ${size}`);
    button.dataset.brushSize = String(size);
    element.append(button);
  }

  parent.append(element);
  renderPressed();
  return Object.freeze({
    element,
    setBrush(size: 1 | 3 | 5): void {
      activeBrush = size;
      renderPressed();
    },
    dispose(): void {
      element.remove();
    },
  });
}
