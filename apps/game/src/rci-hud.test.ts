import {
  createFoundationRciRegistries,
  createInitialRciSnapshot,
} from '@web-three-city/rci-core';
import { afterEach, describe, expect, it } from 'vitest';
import { createRciHudModel, mountRciHud } from './rci-hud.js';

afterEach(() => {
  document.body.replaceChildren();
});

describe('RCI HUD', () => {
  it('projects compact Population, Housing, Employment, and Demand values', () => {
    const registries = createFoundationRciRegistries();
    const initial = createInitialRciSnapshot({ absoluteTick: 32 });
    const snapshot = {
      ...initial,
      population: {
        revision: 1,
        citizens: [
          {
            citizenId: 'citizen:1',
            presence: 'resident' as const,
            sexDefinitionId: 'sex.female',
            bornAtTick: 32 - 25 * 8_640,
            movedIntoCityAtTick: 0,
            movedOutOfCityAtTick: null,
            diedAtTick: null,
          },
        ],
        qualifications: [],
      },
      households: {
        revision: 1,
        households: [
          { householdId: 'household:1', foundedAtTick: 0, dissolvedAtTick: null },
        ],
        memberships: [
          {
            membershipId: 'household-membership:1',
            householdId: 'household:1',
            citizenId: 'citizen:1',
            startedAtTick: 0,
            endedAtTick: null,
            endReasonDefinitionId: null,
          },
        ],
      },
      demand: {
        revision: 1,
        demand: {
          residentialMilli: 20_000,
          commercialMilli: -5_000,
          industrialMilli: 10_000,
          evaluatedAtTick: 32,
        },
        growthGates: {
          residentialOpen: true,
          commercialOpen: false,
          industrialOpen: true,
          evaluatedAtTick: 32,
        },
      },
    };
    expect(createRciHudModel(snapshot, registries, 32)).toMatchObject({
      population: 1,
      households: 1,
      residentialDemand: 20,
      commercialDemand: -5,
      industrialDemand: 10,
    });

    const panel = document.createElement('aside');
    const activeTool = document.createElement('button');
    activeTool.dataset.testid = 'active-tool';
    activeTool.dataset.selected = 'true';
    panel.append(activeTool);
    document.body.append(panel);
    const hud = mountRciHud(panel);
    hud.update(snapshot, registries, 32);

    expect(panel.querySelector('[data-testid="rci-population"]')?.textContent).toBe('1');
    expect(panel.querySelector('[data-testid="rci-households"]')?.textContent).toBe('1');
    expect(panel.querySelector('[data-testid="rci-demand-residential"]')?.textContent).toBe(
      '+20 open',
    );
    expect(activeTool.dataset.selected).toBe('true');
    hud.dispose();
    expect(activeTool.isConnected).toBe(true);
  });
});
