import type { AgeBandDefinitionId } from '../population/age.js';
import type { MacroHourIndex } from '@web-three-city/simulation-core';

export type RciDomainEventType =
  | 'citizen.reached-age-band'
  | 'citizen.born'
  | 'citizen.died'
  | 'qualification.awarded'
  | 'relationship.ended'
  | 'household.dissolved';

export interface RciDomainEventBase {
  readonly type: RciDomainEventType;
  readonly macroHourIndex: MacroHourIndex;
  readonly priority: number;
  readonly entityKind: 'citizen' | 'relationship' | 'household' | 'qualification';
  readonly entityId: string;
  readonly sequence: number;
}

export interface RciDomainEvent extends RciDomainEventBase {
  readonly ageBandDefinitionId?: AgeBandDefinitionId;
}

export interface CitizenReachedAgeBandEvent extends RciDomainEvent {
  readonly type: 'citizen.reached-age-band';
  readonly ageBandDefinitionId: AgeBandDefinitionId;
}

export interface CitizenBornEvent extends RciDomainEvent {
  readonly type: 'citizen.born';
}

export interface CitizenDiedEvent extends RciDomainEvent {
  readonly type: 'citizen.died';
}

export interface QualificationAwardedEvent extends RciDomainEvent {
  readonly type: 'qualification.awarded';
}

export interface RelationshipEndedEvent extends RciDomainEvent {
  readonly type: 'relationship.ended';
}

export interface HouseholdDissolvedEvent extends RciDomainEvent {
  readonly type: 'household.dissolved';
}
