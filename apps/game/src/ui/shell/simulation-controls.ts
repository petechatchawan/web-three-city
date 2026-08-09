import type { SimulationSpeed } from '@web-three-city/simulation-core';
import { createButton } from '../components/button.js';

export interface SimulationControlCallbacks {
  readonly setSpeed: (speed: SimulationSpeed) => void;
  readonly step: () => void;
}

export function mountSimulationControls(
  parent: HTMLElement,
  callbacks: SimulationControlCallbacks,
  options: { compact?: boolean } = {},
): HTMLElement {
  const element = document.createElement('div');
  element.className = options.compact
    ? 'city-simulation-controls city-simulation-controls--compact'
    : 'city-simulation-controls';
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', 'Simulation speed');
  const controls = [
    [createButton('Paused', () => callbacks.setSpeed('paused')), 'Set paused speed'],
    [createButton('1×', () => callbacks.setSpeed('normal')), 'Set normal speed'],
    [createButton('2×', () => callbacks.setSpeed('fast')), 'Set fast speed'],
    [createButton('4×', () => callbacks.setSpeed('faster')), 'Set faster speed'],
    [createButton('Step', callbacks.step), 'Advance exactly one tick'],
  ] as const;
  for (const [button, label] of controls) button.setAttribute('aria-label', label);
  element.append(...controls.map(([button]) => button));
  parent.append(element);
  return element;
}
