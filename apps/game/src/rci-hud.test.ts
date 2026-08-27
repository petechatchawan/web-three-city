import {
  ageOriginMacroHour,
  createFoundationRciRegistries,
  createInitialRciSnapshot,
} from '@web-three-city/rci-core';
import { macroHourIndex } from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import { createRciHudModel } from './rci-hud.js';

describe('RCI HUD model', () => {
  it('projects compact Population, Housing, Employment, and Demand values', () => {
    const registries = createFoundationRciRegistries();
    const initial = createInitialRciSnapshot({ absoluteMacroHourIndex: macroHourIndex(32) });
    const snapshot = {
      ...initial,
      population: {
        revision: 1,
        citizens: [
          {
            citizenId: 'citizen:1',
            presence: 'resident' as const,
            sexDefinitionId: 'sex.female',
            bornAtMacroHourIndex: ageOriginMacroHour(32 - 25 * 288),
            movedIntoCityAtMacroHourIndex: macroHourIndex(0),
            movedOutOfCityAtMacroHourIndex: null,
            diedAtMacroHourIndex: null,
          },
        ],
        qualifications: [],
      },
      households: {
        revision: 1,
        households: [
          {
            householdId: 'household:1',
            foundedAtMacroHourIndex: macroHourIndex(0),
            dissolvedAtMacroHourIndex: null,
          },
        ],
        memberships: [
          {
            membershipId: 'household-membership:1',
            householdId: 'household:1',
            citizenId: 'citizen:1',
            startedAtMacroHourIndex: macroHourIndex(0),
            endedAtMacroHourIndex: null,
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
          evaluatedAtMacroHourIndex: macroHourIndex(32),
        },
        growthGates: {
          residentialOpen: true,
          commercialOpen: false,
          industrialOpen: true,
          evaluatedAtMacroHourIndex: macroHourIndex(32),
        },
      },
    };
    expect(createRciHudModel(snapshot, registries, macroHourIndex(32))).toMatchObject({
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
