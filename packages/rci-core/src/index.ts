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
export { createRciCurrentStateIndex } from './projection/population-index.js';
export type { RciCurrentStateIndex } from './projection/population-index.js';
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
export { validateRciSnapshot } from './validation/rci-validation.js';
export type { RciValidationIssue, RciValidationResult } from './validation/rci-validation.js';
