import { createFoundationRciRegistries } from '@web-three-city/rci-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApplicationFixture } from '../../test/application-fixtures.js';
import { mountCityUi } from './city-ui-runtime.js';

afterEach(() => document.body.replaceChildren());

describe('City UI runtime', () => {
  it('opens and refreshes a dialog without emitting simulation or gameplay intents', () => {
    const setSpeed = vi.fn();
    const step = vi.fn();
    const toolSentinel = { active: 'road-build', undo: true } as const;
    const ui = mountCityUi(document.body, {
      setSpeed,
      step,
      selectTool: vi.fn(),
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
    ui.element
      .querySelector<HTMLButtonElement>('.city-top-actions button:nth-child(2)')
      ?.click();
    ui.update(world);
    expect(ui.dialogHost.activeRoute?.key).toBe('city-overview');
    expect(setSpeed).not.toHaveBeenCalled();
    expect(step).not.toHaveBeenCalled();
    expect(toolSentinel).toEqual({ active: 'road-build', undo: true });

    ui.dialogHost.close();
    ui.element
      .querySelector<HTMLButtonElement>('.city-top-actions button:nth-child(3)')
      ?.click();
    expect(ui.dialogHost.activeRoute?.key).toBe('game-menu');
    const sections = [...ui.element.querySelectorAll<HTMLElement>('[data-menu-section]')].map(
      (section) => section.dataset.menuSection,
    );
    expect(sections).toEqual(['world', 'camera', 'presentation']);
    expect(ui.element.querySelectorAll('.city-menu-tile').length).toBeGreaterThanOrEqual(6);
  });
});
