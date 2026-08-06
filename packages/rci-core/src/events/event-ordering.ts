import { compareStableId } from '../contracts/ids.js';
import type { RciDomainEvent } from './rci-domain-event.js';

export function orderRciDomainEvents(events: readonly RciDomainEvent[]): readonly RciDomainEvent[] {
  return Object.freeze(
    events
      .map((event) => Object.freeze({ ...event }) as RciDomainEvent)
      .sort(
        (first, second) =>
          first.tick - second.tick ||
          first.priority - second.priority ||
          compareStableId(first.entityKind, second.entityKind) ||
          compareStableId(first.entityId, second.entityId) ||
          first.sequence - second.sequence,
      ),
  );
}
