import type { SimulationSpeed } from '@web-three-city/simulation-core';
import type { GameTimePresentation } from './game-time-presentation.js';

export interface GameTimeUi {
  readonly root: HTMLElement;
  readonly pauseButton: HTMLButtonElement;
  readonly playButton: HTMLButtonElement;
  readonly fastButton: HTMLButtonElement;
  readonly fasterButton: HTMLButtonElement;
  readonly stepButton: HTMLButtonElement;
  update(speed: SimulationSpeed, presentation: GameTimePresentation): void;
  dispose(): void;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`game-time-ui:missing:${selector}`);
  return element;
}

export function mountGameTimeUi(
  gameRoot: HTMLElement,
  onSpeed: (speed: SimulationSpeed) => void,
  onStep: () => void,
): GameTimeUi {
  const hud = requireElement<HTMLElement>(gameRoot, '.game-hud');
  const section = document.createElement('section');
  section.className = 'game-time-controls';
  section.setAttribute('aria-label', 'Simulation time controls');
  section.setAttribute('data-world-input-block', '');
  section.innerHTML = `
    <div class="game-time-summary">
      <strong data-testid="game-calendar">Y1 M1 D1 08:00</strong>
      <span>Construction <strong data-testid="building-construction-count">0</strong></span>
      <span>Active <strong data-testid="building-active-count">0</strong></span>
      <span>Total <strong data-testid="building-total-count">0</strong></span>
    </div>
    <div class="game-time-buttons">
      <button type="button" data-action="time-pause" aria-label="Pause simulation" aria-pressed="false">Pause</button>
      <button type="button" data-action="time-play" aria-label="Normal simulation speed" aria-pressed="true">Play</button>
      <button type="button" data-action="time-fast" aria-label="Fast simulation speed" aria-pressed="false">2×</button>
      <button type="button" data-action="time-faster" aria-label="Faster simulation speed" aria-pressed="false">4×</button>
      <button type="button" data-action="time-step" aria-label="Advance exactly one hour" disabled>Step</button>
    </div>
  `;
  const secondary = hud.querySelector('.secondary-controls');
  hud.insertBefore(section, secondary);

  const pauseButton = requireElement<HTMLButtonElement>(section, '[data-action="time-pause"]');
  const playButton = requireElement<HTMLButtonElement>(section, '[data-action="time-play"]');
  const fastButton = requireElement<HTMLButtonElement>(section, '[data-action="time-fast"]');
  const fasterButton = requireElement<HTMLButtonElement>(section, '[data-action="time-faster"]');
  const stepButton = requireElement<HTMLButtonElement>(section, '[data-action="time-step"]');
  const calendar = requireElement<HTMLElement>(section, '[data-testid="game-calendar"]');
  const construction = requireElement<HTMLElement>(
    section,
    '[data-testid="building-construction-count"]',
  );
  const active = requireElement<HTMLElement>(section, '[data-testid="building-active-count"]');
  const total = requireElement<HTMLElement>(section, '[data-testid="building-total-count"]');
  const controller = new AbortController();
  pauseButton.addEventListener('click', () => onSpeed('paused'), { signal: controller.signal });
  playButton.addEventListener('click', () => onSpeed('normal'), { signal: controller.signal });
  fastButton.addEventListener('click', () => onSpeed('fast'), { signal: controller.signal });
  fasterButton.addEventListener('click', () => onSpeed('faster'), { signal: controller.signal });
  stepButton.addEventListener('click', onStep, { signal: controller.signal });

  return Object.freeze({
    root: section,
    pauseButton,
    playButton,
    fastButton,
    fasterButton,
    stepButton,
    update(speed: SimulationSpeed, presentation: GameTimePresentation) {
      const buttons: ReadonlyArray<readonly [HTMLButtonElement, SimulationSpeed]> = [
        [pauseButton, 'paused'],
        [playButton, 'normal'],
        [fastButton, 'fast'],
        [fasterButton, 'faster'],
      ];
      for (const [button, candidate] of buttons) {
        button.setAttribute('aria-pressed', String(speed === candidate));
        button.classList.toggle('is-active', speed === candidate);
      }
      stepButton.disabled = speed !== 'paused';
      calendar.textContent = presentation.calendarLabel;
      construction.textContent = String(presentation.constructionCount);
      active.textContent = String(presentation.activeCount);
      total.textContent = String(presentation.totalCount);
    },
    dispose() {
      controller.abort();
      section.remove();
    },
  });
}
