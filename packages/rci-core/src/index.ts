export { RciContractError } from './contracts/errors.js';
export type { RciContractErrorCode } from './contracts/errors.js';
export type {
  CapacityProfileDefinitionId,
  CitizenId,
  CitizenQualificationId,
  DefinitionId,
  DemandFactorDefinitionId,
  DwellingUnitId,
  EmploymentAssignmentId,
  EmploymentRequirementDefinitionId,
  HouseholdId,
  HouseholdMembershipId,
  HousingAssignmentId,
  IncomingHouseholdRequestId,
  MigrationArchetypeDefinitionId,
  OccupationDefinitionId,
  PositionGroupDefinitionId,
  QualificationDefinitionId,
  RelationshipId,
  RelationshipTypeDefinitionId,
  SexDefinitionId,
  WorkplaceId,
} from './contracts/ids.js';
export type { RciRecordMutationPlan } from './contracts/mutation-plan.js';
export type {
  CitizenQualificationRecord,
  CitizenRecord,
  DemandMilliPoint,
  DirectionalRelationshipRecord,
  DisplacedHouseholdEntry,
  DwellingUnitRecord,
  EmploymentAssignmentRecord,
  HouseholdMembershipRecord,
  HouseholdRecord,
  HousingAssignmentRecord,
  IncomingHouseholdRequest,
  RciDemandState,
  RciGrowthGateState,
  RelationshipRecord,
  UndirectedRelationshipRecord,
  WorkplaceRecord,
} from './contracts/records.js';
export { createBuildingGrowthPolicy } from './demand/building-growth-policy.js';
export { evaluateRciDemand, smoothRciDemand } from './demand/demand-evaluator.js';
export type { RciDemandEvaluation } from './demand/demand-evaluator.js';
export { FOUNDATION_RCI_DEMAND_FACTORS, clampDemandMilli } from './demand/demand-factor.js';
export type {
  RciDemandChannel,
  RciDemandFactorContext,
  RciDemandFactorContribution,
  RciDemandFactorDefinition,
} from './demand/demand-factor.js';
export { updateRciGrowthGates } from './demand/growth-gate.js';
export { createFoundationRciRegistries } from './definitions/foundation-definitions.js';
export type {
  AnnualRateBandDefinition,
  CapacityProfileDefinition,
  DefinitionRegistry,
  DemandFactorDefinitionContract,
  EmploymentRequirementDefinition,
  MigrationAgeRangeDefinition,
  MigrationArchetypeDefinition,
  OccupationDefinition,
  PopulationRateProfileDefinition,
  PositionGroupCapacityDefinition,
  PositionGroupDefinition,
  QualificationDefinition,
  RciDefinitionExtensions,
  RciDefinitionRegistries,
  RelationshipTypeDefinition,
  ResidentialCapacityProfileDefinition,
  SexDefinition,
  WorkplaceCapacityProfileDefinition,
} from './definitions/contracts.js';
export { createEmploymentIndex, positionKey } from './employment/employment-index.js';
export type { EmploymentIndex, EmploymentProjection } from './employment/employment-index.js';
export { planEmploymentReconciliation } from './employment/employment-reconciliation.js';
export type { EmploymentReconciliationPlan } from './employment/employment-reconciliation.js';
export { FOUNDATION_EMPLOYMENT_EMIGRATION_FACTORS } from './employment/employment-pressure.js';
export {
  isWorkplaceCapacityProfile,
  workplaceCapacityProfileForId,
} from './employment/workplace-capacity.js';
export { synchronizeWorkplaceInventory } from './employment/workplace-inventory.js';
export type { WorkplaceInventorySynchronizationResult } from './employment/workplace-inventory.js';
export { orderRciDomainEvents } from './events/event-ordering.js';
export type {
  CitizenBornEvent,
  CitizenDiedEvent,
  CitizenReachedAgeBandEvent,
  HouseholdDissolvedEvent,
  QualificationAwardedEvent,
  RciDomainEvent,
  RciDomainEventBase,
  RciDomainEventType,
  RelationshipEndedEvent,
} from './events/rci-domain-event.js';
export {
  planEndHouseholdMembership,
  planStartHouseholdMembership,
} from './households/membership-plan.js';
export {
  isResidentialCapacityProfile,
  residentialCapacityProfileForId,
} from './housing/capacity-profile.js';
export { synchronizeDwellingInventory } from './housing/dwelling-inventory.js';
export type { DwellingInventorySynchronizationResult } from './housing/dwelling-inventory.js';
export {
  endHousingAssignments,
  planStartHousingAssignment,
} from './housing/housing-assignment-plan.js';
export { createHousingIndex } from './housing/housing-index.js';
export type { HousingIndex, HousingProjection } from './housing/housing-index.js';
export { planHousingReconciliation } from './housing/housing-reconciliation.js';
export type { HousingReconciliationPlan } from './housing/housing-reconciliation.js';
export { orderDisplacedHouseholds, planDisplaceHousehold } from './migration/displaced-queue.js';
export {
  FOUNDATION_HOUSING_EMIGRATION_FACTORS,
  evaluateHouseholdEmigrationPressure,
} from './migration/emigration-pressure.js';
export type {
  EmigrationPressureContext,
  EmigrationPressureFactorDefinition,
} from './migration/emigration-pressure.js';
export { planEmigrateHousehold } from './migration/household-emigration.js';
export { planMaterializeIncomingHousehold } from './migration/household-materialization.js';
export { orderIncomingHouseholdRequests } from './migration/incoming-queue.js';
export { createFoundationMigrationRequestPolicy } from './migration/request-policy.js';
export type { MigrationRequestPolicy } from './migration/request-policy.js';
export { createRciMigrationInventory } from './persistence/migration-inventory.js';
export { decodeRciSaveV1, encodeRciSaveV1 } from './persistence/serialization.js';
export type { RciSaveError, RciSaveErrorCode, RciSaveV1 } from './persistence/serialization.js';
export {
  RCI_CYCLES_PER_CALENDAR_YEAR,
  RCI_DAYS_PER_YEAR,
  RCI_MACRO_HOURS_PER_CALENDAR_YEAR,
  RCI_MACRO_HOURS_PER_SIMULATION_CYCLE,
  RCI_TICKS_PER_DAY,
  RCI_TICKS_PER_YEAR,
  ageBandAtTick,
  ageBandAtMacroHour,
  ageYearsAtTick,
  ageYearsAtMacroHour,
  isDailyLifecycleTick,
} from './population/age.js';
export type { AgeBandDefinitionId } from './population/age.js';
export {
  DETERMINISTIC_SAMPLE_ALGORITHM,
  PROBABILITY_SCALE,
  deterministicSample,
} from './population/deterministic-sample.js';
export type { ProbabilityUnit } from './population/deterministic-sample.js';
export {
  ANNUAL_RATE_SCALE,
  compileAnnualRateToDailyHazard,
  compileAnnualRateToCycleHazard,
  sampleSucceeds,
} from './population/hazard.js';
export { planAwardCitizenQualification } from './population/qualification-plan.js';
export { createFoundationQualificationResolver } from './population/qualification-resolver.js';
export type {
  QualificationResolver,
  QualificationResolverContext,
  QualificationResolverOptions,
} from './population/qualification-resolver.js';
export { createRciCurrentStateIndex } from './projection/population-index.js';
export type { RciCurrentStateIndex } from './projection/population-index.js';
export { createRciProjection } from './projection/rci-projection.js';
export type { RciProjection } from './projection/rci-projection.js';
export { FOUNDATION_RCI_CONFIGURATION } from './rci-configuration.js';
export type { RciConfiguration } from './rci-configuration.js';
export {
  DEFAULT_RCI_DETERMINISTIC_SEED,
  createInitialRciSnapshot,
  createRciSnapshot,
} from './rci-snapshot.js';
export type {
  EmploymentSnapshot,
  HouseholdSnapshot,
  HousingSnapshot,
  MigrationSnapshot,
  PopulationSnapshot,
  RciDemandSnapshot,
  RciSequenceState,
  RciSnapshot,
  RciValidationContext,
  RelationshipSnapshot,
} from './rci-snapshot.js';
export { commitRciTick, planRciTick } from './rci-tick.js';
export type { RciTickCommitInput, RciTickInput, RciTickPlan, RciTickReceipt } from './rci-tick.js';
export {
  planCreateDirectionalRelationship,
  planCreatePartnerRelationship,
  planEndPartnerRelationship,
} from './relationships/relationship-plan.js';
export { validateRciSnapshot } from './validation/rci-validation.js';
export type { RciValidationIssue, RciValidationResult } from './validation/rci-validation.js';
