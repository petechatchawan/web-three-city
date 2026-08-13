import type { SimulationSpeed } from '@web-three-city/simulation-core';
import { createCityIcon } from '../components/icon.js';

export interface SimulationControlCallbacks {
  readonly setSpeed: (speed: SimulationSpeed) => void;
  readonly step: () => void;
}

const speedCycle: readonly SimulationSpeed[] = ['paused', 'normal', 'fast', 'faster'];
const speedLabel: Readonly<Record<SimulationSpeed, string>> = {
  paused: 'Ⅱ',
  normal: '1×',
  fast: '2×',
  faster: '4×',
};

export function mountSimulationControls(
  parent: HTMLElement,
  callbacks: SimulationControlCallbacks,
  options: { compact?: boolean } = {},
): HTMLElement {
  const element = document.createElement('div');
  element.className = options.compact
    ? 'city-simulation-controls city-simulation-controls--top-actions city-simulation-controls--compact'
    : 'city-simulation-controls city-simulation-controls--top-actions';
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', 'Simulation speed');

  let activeSpeed: SimulationSpeed = 'paused';
  const speedButton = document.createElement('button');
  speedButton.type = 'button';
  speedButton.className = 'city-icon-button city-speed-toggle';

  const render = (): void => {
    speedButton.textContent = speedLabel[activeSpeed];
    speedButton.dataset.simulationSpeed = activeSpeed;
    const index = speedCycle.indexOf(activeSpeed);
    const nextSpeed = speedCycle[(index + 1) % speedCycle.length]!;
    speedButton.setAttribute(
      'aria-label',
      `Simulation ${speedLabel[activeSpeed]}; switch to ${speedLabel[nextSpeed]}`,
    );
    speedButton.title = `Simulation speed: ${speedLabel[activeSpeed]}`;

    const existingStep = element.querySelector('[data-simulation-step]');
    if (activeSpeed !== 'paused') {
      existingStep?.remove();
      return;
    }
    if (existingStep !== null) return;
    const stepButton = document.createElement('button');
    stepButton.type = 'button';
    stepButton.className = 'city-icon-button city-step-action';
    stepButton.dataset.simulationStep = '';
    stepButton.setAttribute('aria-label', 'Advance exactly one tick');
    stepButton.title = 'Step one tick';
    stepButton.append(createCityIcon('step'));
    stepButton.addEventListener('click', callbacks.step);
    element.append(stepButton);
  };

  speedButton.addEventListener('click', () => {
    const index = speedCycle.indexOf(activeSpeed);
    activeSpeed = speedCycle[(index + 1) % speedCycle.length]!;
    callbacks.setSpeed(activeSpeed);
    render();
  });

  element.append(speedButton);
  parent.append(element);
  render();
  return element;
}
