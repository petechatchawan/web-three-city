import { FOUNDATION_ECONOMY_RULES } from '@web-three-city/economy-core';
import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../../test/application-fixtures.js';
import { CommittedWorldStore } from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';
import { executeEconomyTaxPolicyCommand } from './economy-tax-policy-command.js';
import { DefaultWorldTransactionCoordinator } from './world-transaction-coordinator.js';

describe('Economy tax policy command', () => {
  it('publishes an accepted typed policy through one committed-world revision', () => {
    const initial = createApplicationFixture();
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(initial),
    });
    const result = executeEconomyTaxPolicyCommand(coordinator, {
      residentialBp: 800,
      commercialBp: 600,
      industrialBp: 700,
    });

    expect(result.status).toBe('accepted');
    expect(coordinator.snapshot().revision).toBe(initial.revision + 1);
    expect(coordinator.snapshot().economy.taxPolicy).toEqual({
      residentialBp: 800,
      commercialBp: 600,
      industrialBp: 700,
    });
  });

  it('returns a typed rejection without publication for invalid policy', () => {
    const initial = createApplicationFixture();
    const coordinator = new DefaultWorldTransactionCoordinator({
      worldStore: new CommittedWorldStore(initial),
    });
    const result = executeEconomyTaxPolicyCommand(coordinator, {
      residentialBp: FOUNDATION_ECONOMY_RULES.maximumTaxRateBp + 1,
      commercialBp: 700,
      industrialBp: 700,
    });

    expect(result).toEqual({ status: 'rejected', reason: 'invalid-policy' });
    expect(fingerprintCommittedWorld(coordinator.snapshot())).toBe(
      fingerprintCommittedWorld(initial),
    );
  });
});
