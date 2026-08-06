import type { AgeBandDefinitionId } from '../population/age.js';

export type RciDomainEventType =
  | 'citizen.reached-age-band'
  | 'citizen.born'
  | 'citizen.died'
  | 'qualification.awarded'
  | 'relationship.ended'
  | 'household.dissolved';

export interface RciDomainEventBase {
  readonly type: RciDomainEventType;
  readonly tick: number;
  readonly priority: number;
  readonly entityKind: 'citizen' | 'relationship' | 'household' | 'qualification';
  readonly entityId: string;
  readonly sequence: number;
}

export interface CitizenReachedAgeBandEvent extends RciDomainEventBase {
  readonly type: 'citizen.reached-age-band';
  readonly ageBandDefinitionId: AgeBandDefinitionId;
}

export interface CitizenBornEvent extends RciDomainEventBase {
  readonly type: 'citizen.born';
}

export interface CitizenDiedEvent extends RciDomainEventBase {
  readonly type: 'citizen.died';
}

export interface QualificationAwardedEvent extends RciDomainEventBase {
  readonly type: 'qualification.awarded';
}

export interface RelationshipEndedEvent extends RciDomainEventBase {
  readonly type: 'relationship.ended';
}

export interface HouseholdDissolvedEvent extends RciDomainEventBase {
  readonly type: 'household.dissolved';
}

export type RciDomainEvent =
  | CitizenReachedAgeBandEvent
  | CitizenBornEvent
  | CitizenDiedEvent
  | QualificationAwardedEvent
  | RelationshipEndedEvent
  | HouseholdDissolvedEvent;
