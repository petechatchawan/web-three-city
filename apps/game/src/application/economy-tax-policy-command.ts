import {
  applyTaxPolicy,
  FOUNDATION_ECONOMY_RULES,
  type EconomyMutationRejectionReason,
  type TaxPolicyInput,
} from '@web-three-city/economy-core';
import { createCommittedWorldFromDomainState } from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';
import type { WorldTransactionCoordinator } from './world-transaction-coordinator.js';

export type EconomyTaxPolicyCommandResult =
  | Readonly<{ status: 'accepted'; worldRevision: number }>
  | Readonly<{
      status: 'rejected';
      reason: EconomyMutationRejectionReason | 'publication-rejected';
    }>;

export function executeEconomyTaxPolicyCommand(
  coordinator: WorldTransactionCoordinator,
  policy: TaxPolicyInput['policy'],
): EconomyTaxPolicyCommandResult {
  const before = coordinator.snapshot();
  const mutation = applyTaxPolicy(
    before.economy,
    { baseRevision: before.economy.revision, policy },
    FOUNDATION_ECONOMY_RULES,
  );
  if (!mutation.ok) return Object.freeze({ status: 'rejected', reason: mutation.reason });

  const nextWorld = createCommittedWorldFromDomainState({
    revision: before.revision + 1,
    terrain: before.terrain,
    roads: before.roads,
    zones: before.zones,
    buildings: before.buildings,
    simulation: before.simulation,
    rci: before.rci,
    economy: mutation.snapshot,
  });
  const publication = coordinator.publish({
    baseRevision: before.revision,
    baseFingerprint: fingerprintCommittedWorld(before),
    nextWorld,
    nextFingerprint: fingerprintCommittedWorld(nextWorld),
  });
  return publication.status === 'committed'
    ? Object.freeze({ status: 'accepted', worldRevision: publication.world.revision })
    : Object.freeze({ status: 'rejected', reason: 'publication-rejected' });
}
