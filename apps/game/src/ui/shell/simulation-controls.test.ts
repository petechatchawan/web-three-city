import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountSimulationControls } from './simulation-controls.js';

afterEach(() => document.body.replaceChildren());

describe('simulation controls', () => {
  it('emits existing speed and exact-step intents', () => {
    const setSpeed = vi.fn();
    const step = vi.fn();
    const controls = mountSimulationControls(document.body, { setSpeed, step });
    const buttons = [...controls.querySelectorAll('button')];
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Paused',
      '1×',
      '2×',
      '4×',
      'Step',
    ]);
    expect(controls.classList.contains('city-simulation-capsule')).toBe(true);
    expect(buttons.every((button) => button.classList.contains('city-segment'))).toBe(true);
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
    buttons[2]?.click();
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('false');
    expect(buttons[2]?.getAttribute('aria-pressed')).toBe('true');
    buttons[4]?.click();
    expect(setSpeed).toHaveBeenCalledWith('fast');
    expect(step).toHaveBeenCalledOnce();
  });
});
