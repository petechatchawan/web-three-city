import type {
  CapacityProfileDefinitionId,
  CitizenId,
  CitizenQualificationId,
  DwellingUnitId,
  EmploymentAssignmentId,
  HouseholdId,
  HouseholdMembershipId,
  HousingAssignmentId,
  IncomingHouseholdRequestId,
  MigrationArchetypeDefinitionId,
  PositionGroupDefinitionId,
  QualificationDefinitionId,
  RelationshipId,
  RelationshipTypeDefinitionId,
  SexDefinitionId,
  WorkplaceId,
} from './ids.js';
import type { MacroHourIndex } from '@web-three-city/simulation-core';
import type { AgeOriginMacroHourIndex } from '../population/age.js';

export interface CitizenRecord {
  readonly citizenId: CitizenId;
  readonly presence: 'resident' | 'emigrated' | 'deceased';
  readonly sexDefinitionId: SexDefinitionId;
  readonly bornAtMacroHourIndex: AgeOriginMacroHourIndex;
  readonly movedIntoCityAtMacroHourIndex: MacroHourIndex;
  readonly movedOutOfCityAtMacroHourIndex: MacroHourIndex | null;
  readonly diedAtMacroHourIndex: MacroHourIndex | null;
}

export interface HouseholdRecord {
  readonly householdId: HouseholdId;
  readonly foundedAtMacroHourIndex: MacroHourIndex;
  readonly dissolvedAtMacroHourIndex: MacroHourIndex | null;
}

export interface HouseholdMembershipRecord {
  readonly membershipId: HouseholdMembershipId;
  readonly householdId: HouseholdId;
  readonly citizenId: CitizenId;
  readonly startedAtMacroHourIndex: MacroHourIndex;
  readonly endedAtMacroHourIndex: MacroHourIndex | null;
  readonly endReasonDefinitionId: string | null;
}

export interface DirectionalRelationshipRecord {
  readonly relationshipId: RelationshipId;
  readonly orientation: 'directional';
  readonly typeDefinitionId: RelationshipTypeDefinitionId;
  readonly sourceCitizenId: CitizenId;
  readonly targetCitizenId: CitizenId;
  readonly startedAtMacroHourIndex: MacroHourIndex;
  readonly endedAtMacroHourIndex: MacroHourIndex | null;
}

export interface UndirectedRelationshipRecord {
  readonly relationshipId: RelationshipId;
  readonly orientation: 'undirected';
  readonly typeDefinitionId: RelationshipTypeDefinitionId;
  readonly participantCitizenIds: readonly [CitizenId, CitizenId];
  readonly startedAtMacroHourIndex: MacroHourIndex;
  readonly endedAtMacroHourIndex: MacroHourIndex | null;
}

export type RelationshipRecord = DirectionalRelationshipRecord | UndirectedRelationshipRecord;

export interface CitizenQualificationRecord {
  readonly citizenQualificationId: CitizenQualificationId;
  readonly citizenId: CitizenId;
  readonly qualificationDefinitionId: QualificationDefinitionId;
  readonly awardedAtMacroHourIndex: MacroHourIndex;
  readonly endedAtMacroHourIndex: MacroHourIndex | null;
  readonly sourceDefinitionId: string;
}

export interface DwellingUnitRecord {
  readonly dwellingUnitId: DwellingUnitId;
  readonly buildingInstanceId: string;
  readonly capacityProfileDefinitionId: CapacityProfileDefinitionId;
  readonly unitIndex: number;
  readonly activatedAtMacroHourIndex: MacroHourIndex;
  readonly retiredAtMacroHourIndex: MacroHourIndex | null;
}

export interface HousingAssignmentRecord {
  readonly housingAssignmentId: HousingAssignmentId;
  readonly householdId: HouseholdId;
  readonly dwellingUnitId: DwellingUnitId;
  readonly startedAtMacroHourIndex: MacroHourIndex;
  readonly endedAtMacroHourIndex: MacroHourIndex | null;
  readonly endReasonDefinitionId: string | null;
}

export interface WorkplaceRecord {
  readonly workplaceId: WorkplaceId;
  readonly buildingInstanceId: string;
  readonly capacityProfileDefinitionId: CapacityProfileDefinitionId;
  readonly activatedAtMacroHourIndex: MacroHourIndex;
  readonly retiredAtMacroHourIndex: MacroHourIndex | null;
}

export interface EmploymentAssignmentRecord {
  readonly employmentAssignmentId: EmploymentAssignmentId;
  readonly citizenId: CitizenId;
  readonly workplaceId: WorkplaceId;
  readonly positionGroupDefinitionId: PositionGroupDefinitionId;
  readonly startedAtMacroHourIndex: MacroHourIndex;
  readonly endedAtMacroHourIndex: MacroHourIndex | null;
  readonly endReasonDefinitionId: string | null;
}

export interface IncomingHouseholdRequest {
  readonly requestId: IncomingHouseholdRequestId;
  readonly archetypeDefinitionId: MigrationArchetypeDefinitionId;
  readonly requestedAtMacroHourIndex: MacroHourIndex;
  readonly minimumResidentCapacity: number;
  readonly queuePriority: number;
  readonly deterministicSequence: number;
}

export interface DisplacedHouseholdEntry {
  readonly householdId: HouseholdId;
  readonly displacedAtMacroHourIndex: MacroHourIndex;
  readonly expiresAtMacroHourIndex: MacroHourIndex;
  readonly minimumResidentCapacity: number;
  readonly displacementPressure: number;
  readonly deterministicSequence: number;
}

export type DemandMilliPoint = number;

export interface RciDemandState {
  readonly residentialMilli: DemandMilliPoint;
  readonly commercialMilli: DemandMilliPoint;
  readonly industrialMilli: DemandMilliPoint;
  readonly evaluatedAtMacroHourIndex: MacroHourIndex;
}

export interface RciGrowthGateState {
  readonly residentialOpen: boolean;
  readonly commercialOpen: boolean;
  readonly industrialOpen: boolean;
  readonly evaluatedAtMacroHourIndex: MacroHourIndex;
}
