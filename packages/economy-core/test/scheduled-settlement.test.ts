import { describe, expect, it } from 'vitest';
import * as economy from '../src/index.js';

const rules = economy.FOUNDATION_ECONOMY_RULES;

const initial = (tick = 8) =>
  economy.createInitialEconomySnapshot(
    { year: 1, month: 1, latestDailySettlementTick: tick },
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
        beforeTick: 8,
        afterTick: 9,
        macroHourTransition: {
          beforeAbsoluteGameMinute: 8 * 60,
          afterAbsoluteGameMinute: 8 * 60 + 1,
          beforeMacroHourIndex: 8,
          afterMacroHourIndex: 8,
          crossed: false,
        },
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
        beforeTick: 7,
        afterTick: 8,
        macroHourTransition: {
          beforeAbsoluteGameMinute: 7 * 60 + 59,
          afterAbsoluteGameMinute: 8 * 60,
          beforeMacroHourIndex: 7,
          afterMacroHourIndex: 8,
          crossed: true,
        },
        calendar: { year: 1, month: 1, day: 1, hour: 8 },
        ...projections,
      },
      rules,
    );

    expect(result).toMatchObject({
      ok: true,
      status: 'settled',
      snapshot: { lastDailySettlementTick: 8 },
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
        beforeTick: 8,
        afterTick: 9,
        calendar: { year: 1, month: 1, day: 1, hour: 9 },
        ...projections,
      },
      rules,
    );
    expect(notDue).toEqual({ ok: true, status: 'not-due', snapshot: initial() });

    const settled = economy.settleScheduledEconomy(
      initial(),
      {
        beforeTick: 31,
        afterTick: 32,
        calendar: { year: 1, month: 1, day: 2, hour: 8 },
        ...projections,
      },
      rules,
    );
    expect(settled).toMatchObject({
      ok: true,
      status: 'settled',
      snapshot: {
        lastDailySettlementTick: 32,
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
          beforeTick: 31,
          afterTick: 32,
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
        beforeTick: 31,
        afterTick: 32,
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
        beforeTick: 727,
        afterTick: 728,
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
        lastMonthlyCloseTick: 728,
      },
    });
  });
});
