import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountSimulationControls } from './simulation-controls.js';

afterEach(() => document.body.replaceChildren());

describe('M6.4 simulation controls', () => {
  it('exposes direct speeds, paused-only Step, and external speed synchronization', () => {
    const setSpeed = vi.fn();
    const step = vi.fn();
    const controls = mountSimulationControls(document.body, { setSpeed, step });

    expect(
      Array.from(
        controls.element.querySelectorAll<HTMLButtonElement>('[data-simulation-speed]'),
        (button) => button.dataset.simulationSpeed,
      ),
    ).toEqual(['paused', 'normal', 'fast', 'faster']);

    const paused = controls.element.querySelector<HTMLButtonElement>(
      '[data-simulation-speed="paused"]',
    )!;
    const normal = controls.element.querySelector<HTMLButtonElement>(
      '[data-simulation-speed="normal"]',
    )!;
    const fast = controls.element.querySelector<HTMLButtonElement>(
      '[data-simulation-speed="fast"]',
    )!;
    const faster = controls.element.querySelector<HTMLButtonElement>(
      '[data-simulation-speed="faster"]',
    )!;

    expect(paused.getAttribute('aria-pressed')).toBe('true');
    expect(controls.element.querySelector('[data-simulation-step]')).not.toBeNull();

    normal.click();
    expect(setSpeed).toHaveBeenLastCalledWith('normal');
    expect(normal.getAttribute('aria-pressed')).toBe('true');
    expect(controls.element.querySelector('[data-simulation-step]')).toBeNull();

    fast.click();
    expect(setSpeed).toHaveBeenLastCalledWith('fast');
    faster.click();
    expect(setSpeed).toHaveBeenLastCalledWith('faster');

    controls.setSpeed('paused');
    expect(paused.getAttribute('aria-pressed')).toBe('true');
    expect(controls.element.querySelector('[data-simulation-step]')).not.toBeNull();
    expect(setSpeed).toHaveBeenCalledTimes(3);

    const stepButton = controls.element.querySelector<HTMLButtonElement>('[data-simulation-step]')!;
    stepButton.click();
    expect(step).toHaveBeenCalledOnce();
  });

  it('localizes speed and paused-only Step labels without changing simulation authority', () => {
    const setSpeed = vi.fn();
    const step = vi.fn();
    const controls = mountSimulationControls(document.body, { setSpeed, step });
    const paused = controls.element.querySelector<HTMLButtonElement>(
      '[data-simulation-speed="paused"]',
    )!;
    const normal = controls.element.querySelector<HTMLButtonElement>(
      '[data-simulation-speed="normal"]',
    )!;

    expect(paused.getAttribute('aria-label')).toBe('Pause');
    expect('setLocale' in controls).toBe(true);
    (controls as unknown as { setLocale(locale: 'en' | 'th'): void }).setLocale('th');

    expect(controls.element.getAttribute('aria-label')).toBe('ความเร็วการจำลอง');
    expect(paused.getAttribute('aria-label')).toBe('หยุดชั่วคราว');
    expect(normal.getAttribute('aria-label')).toBe('เล่น');
    expect(
      controls.element.querySelector('[data-simulation-step]')?.getAttribute('aria-label'),
    ).toBe('เดินหน้า 1 ติ๊ก');
    expect(setSpeed).not.toHaveBeenCalled();
    expect(step).not.toHaveBeenCalled();
  });
});
