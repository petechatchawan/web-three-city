import { describe, expect, it } from 'vitest';
import * as economy from '../src/index.js';
import {
  absoluteGameMinute,
  deriveMacroHourTransition,
  macroHourIndex,
} from '@web-three-city/simulation-core';

const rules = economy.FOUNDATION_ECONOMY_RULES;

const initial = (tick = 8) =>
  economy.createInitialEconomySnapshot(
    { year: 1, month: 1, latestCycleSettlementAtMacroHourIndex: macroHourIndex(tick) },
    rules,
  );

const projections = {
  taxableActivity: {
    occupiedResidentialDwellings: 3,
    occupiedCommercialPositions: 2,
    occupiedIndustrialPositions: 1,
  },
  roadMaintenance: { occupiedRoadCells: 4 },
} as const;

describe('scheduled municipal settlement', () => {
  it('does not settle repeatedly during minute transitions within 08:00', () => {
    const result = economy.settleScheduledEconomy(
      initial(),
      {
        beforeMacroHourIndex: macroHourIndex(8),
        afterMacroHourIndex: macroHourIndex(9),
        macroHourTransition: deriveMacroHourTransition(
          absoluteGameMinute(8 * 60),
          absoluteGameMinute(8 * 60 + 1),
        ),
        calendar: { year: 1, month: 1, day: 1, hour: 8 },
        ...projections,
      },
      rules,
    );

    expect(result).toEqual({ ok: true, status: 'not-due', snapshot: initial() });
  });

  it('settles once when 07:59 crosses into 08:00', () => {
    const result = economy.settleScheduledEconomy(
      initial(7),
      {
        beforeMacroHourIndex: macroHourIndex(7),
        afterMacroHourIndex: macroHourIndex(8),
        macroHourTransition: deriveMacroHourTransition(
          absoluteGameMinute(7 * 60 + 59),
          absoluteGameMinute(8 * 60),
        ),
        calendar: { year: 1, month: 1, day: 1, hour: 8 },
        ...projections,
      },
      rules,
    );

    expect(result).toMatchObject({
      ok: true,
      status: 'settled',
      snapshot: {
        latestCycleSettlementAtMacroHourIndex: macroHourIndex(8),
        treasuryBalanceMinor: 10_004_640,
        currentPeriod: {
          taxRevenue: { residentialMinor: 2_100, commercialMinor: 2_100, industrialMinor: 840 },
          expenses: { roadMaintenanceMinor: 400 },
        },
      },
    });
  });

  it('keeps the 08:00 settlement cadence at one settlement per 24-hour cycle', () => {
    const afterEight = economy.settleScheduledEconomy(
      initial(8),
      {
        beforeMacroHourIndex: macroHourIndex(8),
        afterMacroHourIndex: macroHourIndex(9),
        macroHourTransition: deriveMacroHourTransition(
          absoluteGameMinute(8 * 60),
          absoluteGameMinute(9 * 60),
        ),
        calendar: { year: 1, month: 1, day: 1, hour: 9 },
        ...projections,
      },
      rules,
    );
    expect(afterEight).toEqual({ ok: true, status: 'not-due', snapshot: initial(8) });

    const nextCycle = economy.settleScheduledEconomy(
      initial(8),
      {
        beforeMacroHourIndex: macroHourIndex(31),
        afterMacroHourIndex: macroHourIndex(32),
        macroHourTransition: deriveMacroHourTransition(
          absoluteGameMinute(31 * 60),
          absoluteGameMinute(32 * 60),
        ),
        calendar: { year: 1, month: 1, day: 2, hour: 8 },
        ...projections,
      },
      rules,
    );
    expect(nextCycle).toMatchObject({
      ok: true,
      status: 'settled',
      snapshot: {
        latestCycleSettlementAtMacroHourIndex: macroHourIndex(32),
        treasuryBalanceMinor: 10_004_640,
      },
    });
  });

  it('derives each tax channel from occupied activity and rounds once after the full product', () => {
    expect(
      economy.calculateDailySettlement(
        projections.taxableActivity,
        projections.roadMaintenance,
        { residentialBp: 333, commercialBp: 333, industrialBp: 333 },
        rules,
      ),
    ).toEqual({
      ok: true,
      delta: {
        taxRevenue: {
          residentialMinor: 999,
          commercialMinor: 999,
          industrialMinor: 400,
        },
        expenses: {
          roadConstructionMinor: 0,
          terraformMinor: 0,
          bulldozeMinor: 0,
          roadMaintenanceMinor: 400,
        },
        refundsMinor: 0,
      },
    });
  });

  it('rejects malformed and overflowing projections without changing Economy', () => {
    expect(
      economy.calculateDailySettlement(
        { ...projections.taxableActivity, occupiedResidentialDwellings: -1 },
        projections.roadMaintenance,
        initial().taxPolicy,
        rules,
      ),
    ).toEqual({ ok: false, reason: 'invalid-projection' });
    expect(
      economy.calculateDailySettlement(
        {
          ...projections.taxableActivity,
          occupiedResidentialDwellings: Number.MAX_SAFE_INTEGER,
        },
        projections.roadMaintenance,
        initial().taxPolicy,
        rules,
      ),
    ).toEqual({ ok: false, reason: 'overflow' });
  });

  it('settles only on a transition into 08:00 and fences duplicate ticks', () => {
    const notDue = economy.settleScheduledEconomy(
      initial(),
      {
        beforeMacroHourIndex: macroHourIndex(8),
        afterMacroHourIndex: macroHourIndex(9),
        calendar: { year: 1, month: 1, day: 1, hour: 9 },
        ...projections,
      },
      rules,
    );
    expect(notDue).toEqual({ ok: true, status: 'not-due', snapshot: initial() });

    const settled = economy.settleScheduledEconomy(
      initial(),
      {
        beforeMacroHourIndex: macroHourIndex(31),
        afterMacroHourIndex: macroHourIndex(32),
        calendar: { year: 1, month: 1, day: 2, hour: 8 },
        ...projections,
      },
      rules,
    );
    expect(settled).toMatchObject({
      ok: true,
      status: 'settled',
      snapshot: {
        latestCycleSettlementAtMacroHourIndex: macroHourIndex(32),
        treasuryBalanceMinor: 10_004_640,
        currentPeriod: {
          taxRevenue: { residentialMinor: 2_100, commercialMinor: 2_100, industrialMinor: 840 },
          expenses: { roadMaintenanceMinor: 400 },
        },
      },
    });
    if (!settled.ok) return;
    expect(
      economy.settleScheduledEconomy(
        settled.snapshot,
        {
          beforeMacroHourIndex: macroHourIndex(31),
          afterMacroHourIndex: macroHourIndex(32),
          calendar: { year: 1, month: 1, day: 2, hour: 8 },
          ...projections,
        },
        rules,
      ),
    ).toEqual({ ok: true, status: 'not-due', snapshot: settled.snapshot });
  });

  it('closes the old month before placing Day 1 revenue into the new period', () => {
    const seeded = economy.settleScheduledEconomy(
      initial(),
      {
        beforeMacroHourIndex: macroHourIndex(31),
        afterMacroHourIndex: macroHourIndex(32),
        calendar: { year: 1, month: 1, day: 2, hour: 8 },
        ...projections,
      },
      rules,
    );
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;
    const nextMonth = economy.settleScheduledEconomy(
      seeded.snapshot,
      {
        beforeMacroHourIndex: macroHourIndex(727),
        afterMacroHourIndex: macroHourIndex(728),
        calendar: { year: 1, month: 2, day: 1, hour: 8 },
        ...projections,
      },
      rules,
    );
    expect(nextMonth).toMatchObject({
      ok: true,
      status: 'settled',
      snapshot: {
        currentPeriod: { year: 1, month: 2, taxRevenue: { residentialMinor: 2_100 } },
        previousPeriod: { year: 1, month: 1, taxRevenue: { residentialMinor: 2_100 } },
        lastMonthlyCloseAtMacroHourIndex: macroHourIndex(728),
      },
    });
  });
});
