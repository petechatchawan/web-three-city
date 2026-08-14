import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountSimulationControls } from './simulation-controls.js';

afterEach(() => document.body.replaceChildren());

describe('M6.3 Figma simulation controls', () => {
  it('exposes direct Pause, Play, 2×, and 4× controls with Step only while paused', () => {
    const setSpeed = vi.fn();
    const step = vi.fn();
    const controls = mountSimulationControls(document.body, { setSpeed, step });

    expect(
      Array.from(
        controls.querySelectorAll<HTMLButtonElement>('[data-simulation-speed]'),
        (button) => button.dataset.simulationSpeed,
      ),
    ).toEqual(['paused', 'normal', 'fast', 'faster']);

    const paused = controls.querySelector<HTMLButtonElement>('[data-simulation-speed="paused"]')!;
    const normal = controls.querySelector<HTMLButtonElement>('[data-simulation-speed="normal"]')!;
    const fast = controls.querySelector<HTMLButtonElement>('[data-simulation-speed="fast"]')!;
    const faster = controls.querySelector<HTMLButtonElement>('[data-simulation-speed="faster"]')!;

    expect(paused.getAttribute('aria-pressed')).toBe('true');
    expect(controls.querySelector('[data-simulation-step]')).not.toBeNull();

    normal.click();
    expect(setSpeed).toHaveBeenLastCalledWith('normal');
    expect(normal.getAttribute('aria-pressed')).toBe('true');
    expect(controls.querySelector('[data-simulation-step]')).toBeNull();

    fast.click();
    expect(setSpeed).toHaveBeenLastCalledWith('fast');
    faster.click();
    expect(setSpeed).toHaveBeenLastCalledWith('faster');
    paused.click();
    expect(setSpeed).toHaveBeenLastCalledWith('paused');

    const stepButton = controls.querySelector<HTMLButtonElement>('[data-simulation-step]')!;
    stepButton.click();
    expect(step).toHaveBeenCalledOnce();
  });
});
