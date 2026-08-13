import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountSimulationControls } from './simulation-controls.js';

afterEach(() => document.body.replaceChildren());

describe('simulation controls', () => {
  it('cycles one top-action speed toggle and shows Step only while paused', () => {
    const setSpeed = vi.fn();
    const step = vi.fn();
    const controls = mountSimulationControls(document.body, { setSpeed, step });
    const speed = controls.querySelector<HTMLButtonElement>('[data-simulation-speed]')!;
    expect(speed.textContent).toBe('Ⅱ');
    expect(controls.querySelector('[data-simulation-step]')).not.toBeNull();

    speed.click();
    expect(setSpeed).toHaveBeenLastCalledWith('normal');
    expect(speed.textContent).toBe('1×');
    expect(controls.querySelector('[data-simulation-step]')).toBeNull();

    speed.click();
    expect(setSpeed).toHaveBeenLastCalledWith('fast');
    expect(speed.textContent).toBe('2×');

    speed.click();
    expect(setSpeed).toHaveBeenLastCalledWith('faster');
    expect(speed.textContent).toBe('4×');

    speed.click();
    expect(setSpeed).toHaveBeenLastCalledWith('paused');
    expect(speed.textContent).toBe('Ⅱ');
    const stepButton = controls.querySelector<HTMLButtonElement>('[data-simulation-step]')!;
    stepButton.click();
    expect(step).toHaveBeenCalledOnce();
  });
});
