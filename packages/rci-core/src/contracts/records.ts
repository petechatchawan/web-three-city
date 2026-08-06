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

export interface CitizenRecord {
  readonly citizenId: CitizenId;
  readonly presence: 'resident' | 'emigrated' | 'deceased';
  readonly sexDefinitionId: SexDefinitionId;
  readonly bornAtTick: number;
  readonly movedIntoCityAtTick: number;
  readonly movedOutOfCityAtTick: number | null;
  readonly diedAtTick: number | null;
}

export interface HouseholdRecord {
  readonly householdId: HouseholdId;
  readonly foundedAtTick: number;
  readonly dissolvedAtTick: number | null;
}

export interface HouseholdMembershipRecord {
  readonly membershipId: HouseholdMembershipId;
  readonly householdId: HouseholdId;
  readonly citizenId: CitizenId;
  readonly startedAtTick: number;
  readonly endedAtTick: number | null;
  readonly endReasonDefinitionId: string | null;
}

export interface DirectionalRelationshipRecord {
  readonly relationshipId: RelationshipId;
  readonly orientation: 'directional';
  readonly typeDefinitionId: RelationshipTypeDefinitionId;
  readonly sourceCitizenId: CitizenId;
  readonly targetCitizenId: CitizenId;
  readonly startedAtTick: number;
  readonly endedAtTick: number | null;
}

export interface UndirectedRelationshipRecord {
  readonly relationshipId: RelationshipId;
  readonly orientation: 'undirected';
  readonly typeDefinitionId: RelationshipTypeDefinitionId;
  readonly participantCitizenIds: readonly [CitizenId, CitizenId];
  readonly startedAtTick: number;
  readonly endedAtTick: number | null;
}

export type RelationshipRecord =
  | DirectionalRelationshipRecord
  | UndirectedRelationshipRecord;

export interface CitizenQualificationRecord {
  readonly citizenQualificationId: CitizenQualificationId;
  readonly citizenId: CitizenId;
  readonly qualificationDefinitionId: QualificationDefinitionId;
  readonly awardedAtTick: number;
  readonly endedAtTick: number | null;
  readonly sourceDefinitionId: string;
}

export interface DwellingUnitRecord {
  readonly dwellingUnitId: DwellingUnitId;
  readonly buildingInstanceId: string;
  readonly capacityProfileDefinitionId: CapacityProfileDefinitionId;
  readonly unitIndex: number;
  readonly activatedAtTick: number;
  readonly retiredAtTick: number | null;
}

export interface HousingAssignmentRecord {
  readonly housingAssignmentId: HousingAssignmentId;
  readonly householdId: HouseholdId;
  readonly dwellingUnitId: DwellingUnitId;
  readonly startedAtTick: number;
  readonly endedAtTick: number | null;
  readonly endReasonDefinitionId: string | null;
}

export interface WorkplaceRecord {
  readonly workplaceId: WorkplaceId;
  readonly buildingInstanceId: string;
  readonly capacityProfileDefinitionId: CapacityProfileDefinitionId;
  readonly activatedAtTick: number;
  readonly retiredAtTick: number | null;
}

export interface EmploymentAssignmentRecord {
  readonly employmentAssignmentId: EmploymentAssignmentId;
  readonly citizenId: CitizenId;
  readonly workplaceId: WorkplaceId;
  readonly positionGroupDefinitionId: PositionGroupDefinitionId;
  readonly startedAtTick: number;
  readonly endedAtTick: number | null;
  readonly endReasonDefinitionId: string | null;
}

export interface IncomingHouseholdRequest {
  readonly requestId: IncomingHouseholdRequestId;
  readonly archetypeDefinitionId: MigrationArchetypeDefinitionId;
  readonly requestedAtTick: number;
  readonly minimumResidentCapacity: number;
  readonly queuePriority: number;
  readonly deterministicSequence: number;
}

export interface DisplacedHouseholdEntry {
  readonly householdId: HouseholdId;
  readonly displacedAtTick: number;
  readonly expiresAtTick: number;
  readonly minimumResidentCapacity: number;
  readonly displacementPressure: number;
  readonly deterministicSequence: number;
}

export type DemandMilliPoint = number;

export interface RciDemandState {
  readonly residentialMilli: DemandMilliPoint;
  readonly commercialMilli: DemandMilliPoint;
  readonly industrialMilli: DemandMilliPoint;
  readonly evaluatedAtTick: number;
}

export interface RciGrowthGateState {
  readonly residentialOpen: boolean;
  readonly commercialOpen: boolean;
  readonly industrialOpen: boolean;
  readonly evaluatedAtTick: number;
}
