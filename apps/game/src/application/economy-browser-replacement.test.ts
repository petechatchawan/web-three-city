import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../../test/application-fixtures.js';
import { CommittedWorldStore } from './committed-world.js';
import { executeEconomyTaxPolicyCommand } from './economy-tax-policy-command.js';
import { DefaultWorldTransactionCoordinator } from './world-transaction-coordinator.js';
import { decodeWorldSave, encodeWorldSaveV8 } from '../world-save.js';

const EXPECTED_REPLACEMENT_CASES = ['typed-tax-policy-command', 'world-save-tax-policy'] as const;

const TAX_POLICY = Object.freeze({
  residentialBp: 800,
  commercialBp: 700,
  industrialBp: 700,
});

const replacementCases = [
  {
    id: 'typed-tax-policy-command',
    run: () => {
      const initial = createApplicationFixture();
      const coordinator = new DefaultWorldTransactionCoordinator({
        worldStore: new CommittedWorldStore(initial),
      });

      const result = executeEconomyTaxPolicyCommand(coordinator, TAX_POLICY);

      expect(result).toEqual({ status: 'accepted', worldRevision: initial.revision + 1 });
      expect(coordinator.snapshot().economy.taxPolicy).toEqual(TAX_POLICY);
    },
  },
  {
    id: 'world-save-tax-policy',
    run: () => {
      const initial = createApplicationFixture();
      const coordinator = new DefaultWorldTransactionCoordinator({
        worldStore: new CommittedWorldStore(initial),
      });
      const result = executeEconomyTaxPolicyCommand(coordinator, TAX_POLICY);
      expect(result.status).toBe('accepted');
      const committed = coordinator.snapshot();
      const saved = encodeWorldSaveV8(
        committed.terrain,
        committed.roads,
        committed.zones,
        committed.buildings,
        committed.simulation,
        committed.rci,
        committed.economy,
        committed.mobility,
        committed.traffic,
      );

      const decoded = decodeWorldSave(saved, WORLD_CONFIG);

      expect(decoded.ok).toBe(true);
      if (!decoded.ok) return;
      expect(decoded.value.economy.taxPolicy).toEqual(TAX_POLICY);
      expect(decoded.value.economy.revision).toBe(committed.economy.revision);
    },
  },
] as const;

describe('Economy browser replacement authority', () => {
  it('enumerates every deterministic Economy assertion selected for migration', () => {
    expect(replacementCases.map(({ id }) => id)).toEqual(EXPECTED_REPLACEMENT_CASES);
  });

  for (const replacementCase of replacementCases) {
    it(`proves ${replacementCase.id}`, replacementCase.run);
  }
});
