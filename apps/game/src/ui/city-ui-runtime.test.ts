import { createFoundationRciRegistries } from '@web-three-city/rci-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApplicationFixture } from '../../test/application-fixtures.js';
import { mountCityUi } from './city-ui-runtime.js';

afterEach(() => document.body.replaceChildren());

describe('City UI runtime', () => {
  it('opens and refreshes management without emitting simulation or gameplay intents', () => {
    const setSpeed = vi.fn();
    const step = vi.fn();
    const selectTool = vi.fn();
    const toolSentinel = { active: 'road-build', undo: true } as const;
    const ui = mountCityUi(document.body, {
      setSpeed,
      step,
      selectTool,
      setTerraformBrush: vi.fn(),
      submitTaxPolicy: vi.fn(() => ({ status: 'accepted' as const })),
      setInformationView: vi.fn(),
      saveWorld: vi.fn(),
      loadWorld: vi.fn(),
      rotateLeft: vi.fn(),
      rotateRight: vi.fn(),
      resetCamera: vi.fn(),
      toggleGrid: vi.fn(),
      setQuality: vi.fn(),
      undo: vi.fn(),
      rciRegistries: createFoundationRciRegistries(),
    });
    const world = createApplicationFixture();
    ui.update(world);
    ui.element.querySelector<HTMLButtonElement>('[data-testid="nav-city"]')?.click();
    ui.update(world);
    expect(ui.dialogHost.activeRoute?.key).toBe('city-overview');
    expect(setSpeed).not.toHaveBeenCalled();
    expect(step).not.toHaveBeenCalled();
    expect(selectTool).not.toHaveBeenCalled();
    expect(toolSentinel).toEqual({ active: 'road-build', undo: true });

    ui.element.querySelector<HTMLButtonElement>('[data-management="game-menu"]')?.click();
    expect(ui.dialogHost.activeRoute?.key).toBe('game-menu');
    const sections = [...ui.element.querySelectorAll<HTMLElement>('[data-menu-section]')].map(
      (section) => section.dataset.menuSection,
    );
    expect(sections).toEqual(['world', 'camera', 'presentation']);
    expect(ui.element.querySelectorAll('.city-menu-tile').length).toBeGreaterThanOrEqual(6);
    expect(selectTool).not.toHaveBeenCalled();
  });
});
