import type { SimulationSpeed } from '@web-three-city/simulation-core';
import { createCityIcon, type CityIconName } from '../components/icon.js';
import { uiText, type UiCopyKey, type UiLocale } from '../presentation-locale.js';

export interface SimulationControlCallbacks {
  readonly setSpeed: (speed: SimulationSpeed) => void;
  readonly step: () => void;
}

export interface SimulationControls {
  readonly element: HTMLElement;
  setSpeed(speed: SimulationSpeed): void;
  setLocale(locale: UiLocale): void;
  dispose(): void;
}

type SpeedDefinition = Readonly<{
  speed: SimulationSpeed;
  labelKey?: UiCopyKey;
  literalLabel?: string;
  icon?: CityIconName;
}>;

const speedDefinitions: readonly SpeedDefinition[] = [
  { speed: 'paused', labelKey: 'pause', icon: 'pause' },
  { speed: 'normal', labelKey: 'play', icon: 'play' },
  { speed: 'fast', literalLabel: '2×' },
  { speed: 'faster', literalLabel: '4×' },
];

export function mountSimulationControls(
  parent: HTMLElement,
  callbacks: SimulationControlCallbacks,
  options: { compact?: boolean; locale?: UiLocale } = {},
): SimulationControls {
  const element = document.createElement('div');
  element.className = options.compact
    ? 'city-simulation-controls city-simulation-controls--bottom city-simulation-controls--compact'
    : 'city-simulation-controls city-simulation-controls--bottom';
  element.setAttribute('role', 'group');

  let activeSpeed: SimulationSpeed = 'paused';
  let locale: UiLocale = options.locale ?? 'en';
  const buttons = new Map<SimulationSpeed, HTMLButtonElement>();

  const labelFor = (definition: SpeedDefinition): string =>
    definition.labelKey === undefined
      ? (definition.literalLabel ?? '')
      : uiText(locale, definition.labelKey);

  const render = (): void => {
    element.setAttribute('aria-label', uiText(locale, 'simulationSpeed'));
    for (const definition of speedDefinitions) {
      const button = buttons.get(definition.speed)!;
      const selected = definition.speed === activeSpeed;
      const label = labelFor(definition);
      button.setAttribute('aria-label', label);
      button.title = label;
      if (definition.icon === undefined) button.textContent = label;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-active', selected);
    }

    const existingStep = element.querySelector<HTMLButtonElement>('[data-simulation-step]');
    if (activeSpeed !== 'paused') {
      existingStep?.remove();
      return;
    }
    if (existingStep !== null) {
      const stepLabel = uiText(locale, 'stepOneTick');
      existingStep.setAttribute('aria-label', stepLabel);
      existingStep.title = stepLabel;
      return;
    }

    const stepButton = document.createElement('button');
    stepButton.type = 'button';
    stepButton.className = 'city-sim-button city-step-action';
    stepButton.dataset.simulationStep = '';
    const stepLabel = uiText(locale, 'stepOneTick');
    stepButton.setAttribute('aria-label', stepLabel);
    stepButton.title = stepLabel;
    stepButton.append(createCityIcon('step'));
    stepButton.addEventListener('click', callbacks.step);
    element.append(stepButton);
  };

  for (const definition of speedDefinitions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'city-sim-button';
    button.dataset.simulationSpeed = definition.speed;
    if (definition.icon !== undefined) button.append(createCityIcon(definition.icon));
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
    setLocale(nextLocale: UiLocale): void {
      locale = nextLocale;
      render();
    },
    dispose(): void {
      element.remove();
    },
  });
}
