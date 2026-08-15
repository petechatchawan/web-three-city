import { createFoundationRciRegistries, createInitialRciSnapshot } from '@web-three-city/rci-core';
import { describe, expect, it } from 'vitest';
import { createRciHudModel } from './rci-hud.js';

describe('RCI HUD model', () => {
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
        households: [{ householdId: 'household:1', foundedAtTick: 0, dissolvedAtTick: null }],
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
      residentialGateOpen: true,
      commercialGateOpen: false,
      industrialGateOpen: true,
    });
  });
});
