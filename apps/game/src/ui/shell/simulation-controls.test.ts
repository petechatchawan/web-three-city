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

  it('renders as a separate segmented simulation capsule and marks the selected speed', () => {
    const controls = mountSimulationControls(document.body, { setSpeed: vi.fn(), step: vi.fn() });
    expect(controls.classList.contains('city-simulation-capsule')).toBe(true);
    const paused = controls.querySelector<HTMLButtonElement>('[data-simulation-speed="paused"]')!;
    const fast = controls.querySelector<HTMLButtonElement>('[data-simulation-speed="fast"]')!;
    expect(paused.classList.contains('city-segment')).toBe(true);
    expect(paused.getAttribute('aria-pressed')).toBe('true');
    fast.click();
    expect(paused.getAttribute('aria-pressed')).toBe('false');
    expect(fast.getAttribute('aria-pressed')).toBe('true');
    const step = controls.querySelector<HTMLButtonElement>('[data-simulation-step]')!;
    expect(step.classList.contains('city-segment')).toBe(true);
  });
});
