import { compareStableId } from '../contracts/ids.js';
import type { RciDomainEvent } from './rci-domain-event.js';
import { compareMacroHours } from '@web-three-city/simulation-core';

export function orderRciDomainEvents(events: readonly RciDomainEvent[]): readonly RciDomainEvent[] {
  return Object.freeze(
    events
      .map((event): RciDomainEvent => Object.freeze({ ...event }))
      .sort(
        (first, second) =>
          compareMacroHours(first.macroHourIndex, second.macroHourIndex) ||
          first.priority - second.priority ||
          compareStableId(first.entityKind, second.entityKind) ||
          compareStableId(first.entityId, second.entityId) ||
          first.sequence - second.sequence,
      ),
  );
}
