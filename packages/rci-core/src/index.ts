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
export { createFoundationRciRegistries } from './definitions/foundation-definitions.js';
export type {
  AnnualRateBandDefinition,
  CapacityProfileDefinition,
  DefinitionRegistry,
  DemandFactorDefinitionContract,
  EmploymentRequirementDefinition,
  MigrationArchetypeDefinition,
  OccupationDefinition,
  PopulationRateProfileDefinition,
  PositionGroupDefinition,
  QualificationDefinition,
  RciDefinitionExtensions,
  RciDefinitionRegistries,
  RelationshipTypeDefinition,
  SexDefinition,
} from './definitions/contracts.js';
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
export { decodeRciSaveV1, encodeRciSaveV1 } from './persistence/serialization.js';
export type { RciSaveError, RciSaveErrorCode, RciSaveV1 } from './persistence/serialization.js';
export {
  RCI_DAYS_PER_YEAR,
  RCI_TICKS_PER_DAY,
  RCI_TICKS_PER_YEAR,
  ageBandAtTick,
  ageYearsAtTick,
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
