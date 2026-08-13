import type { SimulationSpeed } from '@web-three-city/simulation-core';
import { createButton } from '../components/button.js';

export interface SimulationControlCallbacks {
  readonly setSpeed: (speed: SimulationSpeed) => void;
  readonly step: () => void;
}

type SpeedControl = Readonly<{
  speed: SimulationSpeed;
  label: string;
  ariaLabel: string;
}>;

const speeds: readonly SpeedControl[] = [
  { speed: 'paused', label: 'Paused', ariaLabel: 'Set paused speed' },
  { speed: 'normal', label: '1×', ariaLabel: 'Set normal speed' },
  { speed: 'fast', label: '2×', ariaLabel: 'Set fast speed' },
  { speed: 'faster', label: '4×', ariaLabel: 'Set faster speed' },
];

export function mountSimulationControls(
  parent: HTMLElement,
  callbacks: SimulationControlCallbacks,
  options: { compact?: boolean } = {},
): HTMLElement {
  const element = document.createElement('div');
  element.className = options.compact
    ? 'city-simulation-controls city-simulation-controls--compact city-simulation-capsule'
    : 'city-simulation-controls city-simulation-capsule';
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', 'Simulation speed');

  let activeSpeed: SimulationSpeed = 'paused';
  const speedButtons = new Map<SimulationSpeed, HTMLButtonElement>();
  const renderPressed = (): void => {
    for (const [speed, button] of speedButtons) {
      const selected = speed === activeSpeed;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-active', selected);
    }
  };

  for (const control of speeds) {
    const button = createButton(control.label, () => {
      activeSpeed = control.speed;
      renderPressed();
      callbacks.setSpeed(control.speed);
    });
    button.className = 'city-segment';
    button.dataset.simulationSpeed = control.speed;
    button.setAttribute('aria-label', control.ariaLabel);
    speedButtons.set(control.speed, button);
    element.append(button);
  }

  const stepButton = createButton('Step', callbacks.step);
  stepButton.className = 'city-segment city-segment--step';
  stepButton.dataset.simulationStep = '';
  stepButton.setAttribute('aria-label', 'Advance exactly one tick');
  element.append(stepButton);
  parent.append(element);
  renderPressed();
  return element;
}
