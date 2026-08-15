import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountBrushSelector } from './brush-stepper.js';

afterEach(() => document.body.replaceChildren());

describe('brush stepper', () => {
  it('renders 1x1, 3x3 and 5x5 brush pills', () => {
    const brush = mountBrushSelector(document.body, vi.fn());
    const sizes = Array.from(
      brush.element.querySelectorAll<HTMLButtonElement>('[data-brush-size]'),
      (b) => Number(b.dataset.brushSize),
    );
    expect(sizes).toEqual([1, 3, 5]);
  });

  it('emits the tapped brush size', () => {
    const onBrush = vi.fn();
    const brush = mountBrushSelector(document.body, onBrush);
    brush.element.querySelector<HTMLButtonElement>('[data-brush-size="5"]')?.click();
    expect(onBrush).toHaveBeenCalledWith(5);
  });

  it('marks the selected brush with aria-pressed', () => {
    const brush = mountBrushSelector(document.body, vi.fn());
    brush.setBrush(3);
    expect(
      brush.element
        .querySelector<HTMLButtonElement>('[data-brush-size="3"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
  });
});
