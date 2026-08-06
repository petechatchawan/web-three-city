import type { BuildingSnapshot } from '@web-three-city/building-core';
import type { SimulationSnapshot } from '@web-three-city/simulation-core';
import { RciContractError, type RciContractErrorCode } from './contracts/errors.js';
import type { RciDefinitionRegistries } from './definitions/contracts.js';
import type { RciDomainEvent } from './events/rci-domain-event.js';
import { synchronizeDwellingInventory } from './housing/dwelling-inventory.js';
import { planHousingReconciliation } from './housing/housing-reconciliation.js';
import { createFoundationMigrationRequestPolicy } from './migration/request-policy.js';
import { isDailyLifecycleTick } from './population/age.js';
import {
  evaluateDailyPopulationLifecycle,
  type PopulationLifecycleResult,
} from './population/daily-lifecycle.js';
import type { QualificationResolver } from './population/qualification-resolver.js';
import type { RciConfiguration } from './rci-configuration.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from './rci-snapshot.js';
import { validateRciSnapshot } from './validation/rci-validation.js';

export interface RciTickInput {
  readonly rci: RciSnapshot;
  readonly simulationBefore: SimulationSnapshot;
  readonly simulationAfter: SimulationSnapshot;
  readonly buildingsBefore: BuildingSnapshot;
  readonly buildingsAfter: BuildingSnapshot;
  readonly registries: RciDefinitionRegistries;
  readonly configuration: RciConfiguration;
  readonly qualificationResolver?: QualificationResolver;
  readonly suitableVacantJobCount?: number;
}

export interface RciTickPlan {
  readonly baseRciRevision: number;
  readonly baseSimulationRevision: number;
  readonly baseBuildingRevision: number;
  readonly beforeAbsoluteTick: number;
  readonly afterAbsoluteTick: number;
  readonly proposedSnapshot: RciSnapshot;
  readonly emittedEvents: readonly RciDomainEvent[];
  readonly valid: boolean;
  readonly invalidReason: RciContractErrorCode | null;
}

export interface RciTickReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly beforeAbsoluteTick: number;
  readonly afterAbsoluteTick: number;
  readonly emittedEventCount: number;
}

export interface RciTickCommitInput {
  readonly rci: RciSnapshot;
  readonly simulationBefore: SimulationSnapshot;
  readonly simulationAfter: SimulationSnapshot;
  readonly buildingsBefore: BuildingSnapshot;
  readonly buildingsAfter: BuildingSnapshot;
  readonly plan: RciTickPlan;
}

function invalidPlan(input: RciTickInput, invalidReason: RciContractErrorCode): RciTickPlan {
  return Object.freeze({
    baseRciRevision: input.rci.revision,
    baseSimulationRevision: input.simulationBefore.revision,
    baseBuildingRevision: input.buildingsBefore.revision,
    beforeAbsoluteTick: input.simulationBefore.absoluteTick,
    afterAbsoluteTick: input.simulationAfter.absoluteTick,
    proposedSnapshot: input.rci,
    emittedEvents: Object.freeze([]),
    valid: false,
    invalidReason,
  });
}

function tickInputsValid(input: RciTickInput): boolean {
  return (
    Number.isSafeInteger(input.simulationBefore.revision) &&
    Number.isSafeInteger(input.simulationAfter.revision) &&
    input.simulationAfter.revision === input.simulationBefore.revision + 1 &&
    Number.isSafeInteger(input.simulationBefore.absoluteTick) &&
    Number.isSafeInteger(input.simulationAfter.absoluteTick) &&
    input.simulationAfter.absoluteTick === input.simulationBefore.absoluteTick + 1 &&
    Number.isSafeInteger(input.buildingsBefore.revision) &&
    Number.isSafeInteger(input.buildingsAfter.revision) &&
    input.configuration.populationRateProfileDefinitionId.length > 0 &&
    input.registries.populationRateProfiles.has(
      input.configuration.populationRateProfileDefinitionId,
    )
  );
}

export function planRciTick(input: RciTickInput): RciTickPlan {
  if (!tickInputsValid(input)) return invalidPlan(input, 'rci:invalid-plan');

  let snapshot = synchronizeDwellingInventory({
    snapshot: input.rci,
    buildingsBefore: input.buildingsBefore,
    buildingsAfter: input.buildingsAfter,
    registries: input.registries,
    evaluationTick: input.simulationAfter.absoluteTick,
    displacedExpiryTicks: input.configuration.displacedExpiryTicks,
  }).proposedSnapshot;
  const emittedEvents: RciDomainEvent[] = [];
  const daily = isDailyLifecycleTick(
    input.simulationBefore.absoluteTick,
    input.simulationAfter.absoluteTick,
  );

  if (daily) {
    let lifecycle: PopulationLifecycleResult = Object.freeze({
      snapshot,
      events: Object.freeze([]),
    });
    lifecycle = evaluateDailyPopulationLifecycle({
      snapshot,
      evaluationTick: input.simulationAfter.absoluteTick,
      registries: input.registries,
      populationRateProfile: input.registries.populationRateProfiles.get(
        input.configuration.populationRateProfileDefinitionId,
      ),
      ...(input.qualificationResolver === undefined
        ? {}
        : { qualificationResolver: input.qualificationResolver }),
    });
    snapshot = lifecycle.snapshot;
    emittedEvents.push(...lifecycle.events);

    const requestPlan = createFoundationMigrationRequestPolicy().planRequests({
      snapshot,
      evaluationTick: input.simulationAfter.absoluteTick,
      suitableVacantJobCount: input.suitableVacantJobCount ?? 0,
      registries: input.registries,
      configuration: input.configuration,
    });
    if (
      requestPlan.requests.length > 0 ||
      requestPlan.nextAttractionMilli !== snapshot.migration.attractionMilli
    ) {
      snapshot = canonicalizeRciSnapshot({
        ...snapshot,
        revision: snapshot.revision + 1,
        migration: {
          ...snapshot.migration,
          revision: snapshot.migration.revision + 1,
          incomingRequests: [
            ...snapshot.migration.incomingRequests,
            ...requestPlan.requests,
          ],
          attractionMilli: requestPlan.nextAttractionMilli,
        },
        sequences: {
          ...snapshot.sequences,
          nextIncomingRequest: requestPlan.nextIncomingRequestSequence,
        },
      });
    }
  }

  snapshot = planHousingReconciliation({
    snapshot,
    evaluationTick: input.simulationAfter.absoluteTick,
    registries: input.registries,
  }).proposedSnapshot;

  const validation = validateRciSnapshot(
    snapshot,
    input.buildingsAfter,
    input.simulationAfter,
    input.registries,
  );
  if (!validation.valid) {
    return invalidPlan(input, validation.issues[0]?.code ?? 'rci:invalid-state');
  }

  return Object.freeze({
    baseRciRevision: input.rci.revision,
    baseSimulationRevision: input.simulationBefore.revision,
    baseBuildingRevision: input.buildingsBefore.revision,
    beforeAbsoluteTick: input.simulationBefore.absoluteTick,
    afterAbsoluteTick: input.simulationAfter.absoluteTick,
    proposedSnapshot: snapshot,
    emittedEvents: Object.freeze(emittedEvents),
    valid: true,
    invalidReason: null,
  });
}

export function commitRciTick(input: RciTickCommitInput): Readonly<{
  snapshot: RciSnapshot;
  receipt: RciTickReceipt;
}> {
  const { plan } = input;
  if (!plan.valid || plan.invalidReason !== null) {
    throw new RciContractError('rci:invalid-plan');
  }
  if (input.rci.revision !== plan.baseRciRevision) {
    throw new RciContractError('rci:stale-rci-plan');
  }
  if (
    input.simulationBefore.revision !== plan.baseSimulationRevision ||
    input.simulationBefore.absoluteTick !== plan.beforeAbsoluteTick ||
    input.simulationAfter.absoluteTick !== plan.afterAbsoluteTick ||
    input.simulationAfter.revision !== input.simulationBefore.revision + 1
  ) {
    throw new RciContractError('rci:stale-simulation-plan');
  }
  if (input.buildingsBefore.revision !== plan.baseBuildingRevision) {
    throw new RciContractError('rci:stale-building-plan');
  }

  return Object.freeze({
    snapshot: plan.proposedSnapshot,
    receipt: Object.freeze({
      beforeRevision: input.rci.revision,
      afterRevision: plan.proposedSnapshot.revision,
      beforeAbsoluteTick: plan.beforeAbsoluteTick,
      afterAbsoluteTick: plan.afterAbsoluteTick,
      emittedEventCount: plan.emittedEvents.length,
    }),
  });
}
