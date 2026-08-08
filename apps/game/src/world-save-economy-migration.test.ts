import { FOUNDATION_ECONOMY_RULES } from '@web-three-city/economy-core';
import { createInitialRciSnapshot } from '@web-three-city/rci-core';
import { createSimulationSnapshot, deriveGameCalendar } from '@web-three-city/simulation-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../test/application-fixtures.js';
import {
  decodeWorldSave,
  encodeWorldSaveV1,
  encodeWorldSaveV2,
  encodeWorldSaveV3,
  encodeWorldSaveV4,
  encodeWorldSaveV5,
} from './world-save.js';

const world = createApplicationFixture();

const legacySaves = [
  ['V1', encodeWorldSaveV1(world.terrain, world.roads)],
  ['V2', encodeWorldSaveV2(world.terrain, world.roads, world.zones)],
  ['V3', encodeWorldSaveV3(world.terrain, world.roads, world.zones, world.buildings)],
  [
    'V4',
    encodeWorldSaveV4(world.terrain, world.roads, world.zones, world.buildings, world.simulation),
  ],
  [
    'V5',
    encodeWorldSaveV5(
      world.terrain,
      world.roads,
      world.zones,
      world.buildings,
      world.simulation,
      world.rci,
    ),
  ],
] as const;

describe('WorldSave V1-V5 Economy migration', () => {
  it.each(legacySaves)('%s creates deterministic zero-history Economy', (_version, save) => {
    const decoded = decodeWorldSave(save, WORLD_CONFIG);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const calendar = deriveGameCalendar(decoded.value.simulation.absoluteTick);
    expect(decoded.value.economy).toMatchObject({
      revision: 0,
      rulesVersion: FOUNDATION_ECONOMY_RULES.rulesVersion,
      treasuryBalanceMinor: FOUNDATION_ECONOMY_RULES.initialTreasuryMinor,
      taxPolicy: {
        residentialBp: FOUNDATION_ECONOMY_RULES.defaultResidentialTaxRateBp,
        commercialBp: FOUNDATION_ECONOMY_RULES.defaultCommercialTaxRateBp,
        industrialBp: FOUNDATION_ECONOMY_RULES.defaultIndustrialTaxRateBp,
      },
      currentPeriod: {
        year: calendar.year,
        month: calendar.month,
        taxRevenue: { residentialMinor: 0, commercialMinor: 0, industrialMinor: 0 },
        expenses: {
          roadConstructionMinor: 0,
          terraformMinor: 0,
          bulldozeMinor: 0,
          roadMaintenanceMinor: 0,
        },
        refundsMinor: 0,
      },
      previousPeriod: null,
    });
  });

  it.each([
    [7, 0],
    [8, 8],
    [9, 8],
    [727, 704],
    [728, 728],
    [8_648, 8_648],
  ])('tick %i migrates with latest eligible boundary %i', (tick, marker) => {
    const simulation = createSimulationSnapshot({
      revision: tick,
      absoluteTick: tick,
      growthSequence: 0,
    });
    const save = encodeWorldSaveV5(
      world.terrain,
      world.roads,
      world.zones,
      world.buildings,
      simulation,
      createInitialRciSnapshot({ absoluteTick: tick }),
    );
    const decoded = decodeWorldSave(save, WORLD_CONFIG);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.value.economy.lastDailySettlementTick).toBe(marker);
  });
});
