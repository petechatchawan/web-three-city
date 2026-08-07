import { describe, expect, it } from 'vitest';
import {
  FOUNDATION_RCI_DEMAND_FACTORS,
  createBuildingGrowthPolicy,
  createInitialRciSnapshot,
  evaluateRciDemand,
  smoothRciDemand,
  updateRciGrowthGates,
} from '../src/index.js';

const context = {
  residentCount: 100,
  householdCount: 50,
  residentCapacity: 96,
  vacantDwellingCount: 0,
  incomingHouseholdCount: 2,
  displacedHouseholdCount: 1,
  workingAgeResidentCount: 60,
  employedResidentCount: 50,
  unemployedResidentCount: 10,
  totalPositionCapacity: 55,
  vacantPositionCount: 5,
  compatibleVacantPositionCount: 5,
  commercialPositionCapacity: 30,
  commercialVacantPositionCount: 2,
  industrialPositionCapacity: 25,
  industrialVacantPositionCount: 3,
} as const;

describe('RCI Demand foundation', () => {
  it('evaluates stable fixed-point factors independently of input order', () => {
    const forward = evaluateRciDemand(context, FOUNDATION_RCI_DEMAND_FACTORS);
    const reverse = evaluateRciDemand(context, [...FOUNDATION_RCI_DEMAND_FACTORS].reverse());
    expect(reverse).toEqual(forward);
    expect(forward.contributions.map((value) => value.factorDefinitionId)).toEqual(
      [...forward.contributions.map((value) => value.factorDefinitionId)].sort(),
    );
  });

  it('recovers every closed growth channel through the final daily evaluation boundary', () => {
    const evaluation = evaluateRciDemand(
      {
        ...context,
        residentCount: 4,
        householdCount: 3,
        residentCapacity: 12,
        vacantDwellingCount: 0,
        incomingHouseholdCount: 0,
        displacedHouseholdCount: 0,
        workingAgeResidentCount: 4,
        employedResidentCount: 4,
        unemployedResidentCount: 0,
        totalPositionCapacity: 4,
        vacantPositionCount: 0,
        compatibleVacantPositionCount: 0,
        commercialPositionCapacity: 2,
        commercialVacantPositionCount: 0,
        industrialPositionCapacity: 2,
        industrialVacantPositionCount: 0,
      },
      FOUNDATION_RCI_DEMAND_FACTORS,
    );
    for (const factorDefinitionId of [
      'demand.residential.target-buffer',
      'demand.commercial.target-buffer',
      'demand.industrial.target-buffer',
    ]) {
      expect(
        evaluation.contributions.find(
          (value) => value.factorDefinitionId === factorDefinitionId,
        )?.valueMilli,
      ).toBe(100_000);
    }
    expect(evaluation.rawResidentialMilli).toBe(50_000);
    expect(evaluation.rawCommercialMilli).toBe(70_000);
    expect(evaluation.rawIndustrialMilli).toBe(70_000);

    let demand = {
      residentialMilli: -32_000,
      commercialMilli: -29_000,
      industrialMilli: -47_000,
      evaluatedAtTick: 248,
    };
    let growthGates = {
      residentialOpen: false,
      commercialOpen: false,
      industrialOpen: false,
      evaluatedAtTick: 248,
    };
    for (const evaluationTick of [272, 296, 320]) {
      demand = smoothRciDemand({ previous: demand, evaluation, evaluationTick });
      growthGates = updateRciGrowthGates({
        previous: growthGates,
        demand,
        evaluationTick,
      });
    }
    expect(demand.evaluatedAtTick).toBe(320);
    expect(growthGates.evaluatedAtTick).toBe(320);
    expect(demand.residentialMilli).toBeGreaterThanOrEqual(15_000);
    expect(demand.commercialMilli).toBeGreaterThanOrEqual(15_000);
    expect(demand.industrialMilli).toBeGreaterThanOrEqual(15_000);
    expect(growthGates).toMatchObject({
      residentialOpen: true,
      commercialOpen: true,
      industrialOpen: true,
    });
  });

  it('smooths with integer arithmetic and persists hysteresis in the neutral band', () => {
    const previous = {
      residentialMilli: 0,
      commercialMilli: 0,
      industrialMilli: 0,
      evaluatedAtTick: 8,
    };
    const demand = smoothRciDemand({
      previous,
      evaluation: {
        rawResidentialMilli: 80_000,
        rawCommercialMilli: 40_000,
        rawIndustrialMilli: -40_000,
        contributions: [],
      },
      evaluationTick: 32,
      smoothingMilli: 250,
    });
    expect(demand).toEqual({
      residentialMilli: 20_000,
      commercialMilli: 10_000,
      industrialMilli: -10_000,
      evaluatedAtTick: 32,
    });
    const opened = updateRciGrowthGates({
      previous: {
        residentialOpen: false,
        commercialOpen: false,
        industrialOpen: true,
        evaluatedAtTick: 8,
      },
      demand,
      evaluationTick: 32,
    });
    expect(opened).toMatchObject({
      residentialOpen: true,
      commercialOpen: false,
      industrialOpen: false,
    });
    const neutral = updateRciGrowthGates({
      previous: { ...opened, commercialOpen: true },
      demand: { ...demand, commercialMilli: 10_000 },
      evaluationTick: 56,
    });
    expect(neutral.commercialOpen).toBe(true);
  });

  it('keeps all zone channels eligible until the first Demand evaluation', () => {
    const policy = createBuildingGrowthPolicy(createInitialRciSnapshot({ absoluteTick: 8 }));
    expect(policy.allowsZone('residential')).toBe(true);
    expect(policy.allowsZone('commercial')).toBe(true);
    expect(policy.allowsZone('industrial')).toBe(true);
    expect(policy.zoneWeightMilli('residential')).toBe(1_000);
    expect(policy.zoneWeightMilli('commercial')).toBe(1_000);
    expect(policy.zoneWeightMilli('industrial')).toBe(1_000);
  });

  it('derives a caller policy without mutating Building state', () => {
    const initial = createInitialRciSnapshot({ absoluteTick: 32 });
    const snapshot = {
      ...initial,
      demand: {
        revision: 3,
        demand: {
          residentialMilli: 25_000,
          commercialMilli: 10_000,
          industrialMilli: -5_000,
          evaluatedAtTick: 32,
        },
        growthGates: {
          residentialOpen: true,
          commercialOpen: true,
          industrialOpen: false,
          evaluatedAtTick: 32,
        },
      },
    };
    const policy = createBuildingGrowthPolicy(snapshot);
    expect(policy.allowsZone('residential')).toBe(true);
    expect(policy.allowsZone('industrial')).toBe(false);
    expect(policy.zoneWeightMilli('residential')).toBeGreaterThan(
      policy.zoneWeightMilli('commercial'),
    );
    expect(policy.zoneWeightMilli('industrial')).toBe(0);
  });
});
