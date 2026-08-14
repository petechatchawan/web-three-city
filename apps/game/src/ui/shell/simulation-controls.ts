import type { SimulationSpeed } from '@web-three-city/simulation-core';
import { createCityIcon, type CityIconName } from '../components/icon.js';

export interface SimulationControlCallbacks {
  readonly setSpeed: (speed: SimulationSpeed) => void;
  readonly step: () => void;
}

export interface SimulationControls {
  readonly element: HTMLElement;
  setSpeed(speed: SimulationSpeed): void;
  dispose(): void;
}

type SpeedDefinition = Readonly<{
  speed: SimulationSpeed;
  label: string;
  icon?: CityIconName;
}>;

const speedDefinitions: readonly SpeedDefinition[] = [
  { speed: 'paused', label: 'Pause', icon: 'pause' },
  { speed: 'normal', label: 'Play', icon: 'play' },
  { speed: 'fast', label: '2×' },
  { speed: 'faster', label: '4×' },
];

export function mountSimulationControls(
  parent: HTMLElement,
  callbacks: SimulationControlCallbacks,
  options: { compact?: boolean } = {},
): SimulationControls {
  const element = document.createElement('div');
  element.className = options.compact
    ? 'city-simulation-controls city-simulation-controls--bottom city-simulation-controls--compact'
    : 'city-simulation-controls city-simulation-controls--bottom';
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', 'Simulation speed');

  let activeSpeed: SimulationSpeed = 'paused';
  const buttons = new Map<SimulationSpeed, HTMLButtonElement>();

  const render = (): void => {
    for (const [speed, button] of buttons) {
      const selected = speed === activeSpeed;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-active', selected);
    }

    const existingStep = element.querySelector('[data-simulation-step]');
    if (activeSpeed !== 'paused') {
      existingStep?.remove();
      return;
    }
    if (existingStep !== null) return;

    const stepButton = document.createElement('button');
    stepButton.type = 'button';
    stepButton.className = 'city-sim-button city-step-action';
    stepButton.dataset.simulationStep = '';
    stepButton.setAttribute('aria-label', 'Advance exactly one tick');
    stepButton.title = 'Step one tick';
    stepButton.append(createCityIcon('step'));
    stepButton.addEventListener('click', callbacks.step);
    element.append(stepButton);
  };

  for (const definition of speedDefinitions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'city-sim-button';
    button.dataset.simulationSpeed = definition.speed;
    button.setAttribute('aria-label', definition.label);
    button.title = definition.label;
    if (definition.icon !== undefined) button.append(createCityIcon(definition.icon));
    else button.textContent = definition.label;
    button.addEventListener('click', () => {
      activeSpeed = definition.speed;
      callbacks.setSpeed(definition.speed);
      render();
    });
    buttons.set(definition.speed, button);
    element.append(button);
  }

  parent.append(element);
  render();

  return Object.freeze({
    element,
    setSpeed(speed: SimulationSpeed): void {
      activeSpeed = speed;
      render();
    },
    dispose(): void {
      element.remove();
    },
  });
}
