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
    buttons[2]?.click();
    buttons[4]?.click();
    expect(setSpeed).toHaveBeenCalledWith('fast');
    expect(step).toHaveBeenCalledOnce();
  });
});
