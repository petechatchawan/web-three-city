import { describe, expect, it } from 'vitest';
import { orderRciDomainEvents, type RciDomainEvent } from '../src/index.js';

const events: readonly RciDomainEvent[] = [
  {
    type: 'citizen.died',
    tick: 32,
    priority: 40,
    entityKind: 'citizen',
    entityId: 'citizen:2',
    sequence: 2,
  },
  {
    type: 'citizen.born',
    tick: 32,
    priority: 30,
    entityKind: 'citizen',
    entityId: 'citizen:3',
    sequence: 3,
  },
  {
    type: 'citizen.reached-age-band',
    tick: 32,
    priority: 10,
    entityKind: 'citizen',
    entityId: 'citizen:1',
    sequence: 1,
    ageBandDefinitionId: 'age-band.working-age',
  },
];

describe('RCI domain event ordering', () => {
  it('orders by tick, priority, entity kind, stable id, and sequence', () => {
    expect(orderRciDomainEvents(events).map((event) => event.type)).toEqual([
      'citizen.reached-age-band',
      'citizen.born',
      'citizen.died',
    ]);
  });

  it('is independent of input order and freezes the result', () => {
    const first = orderRciDomainEvents(events);
    const second = orderRciDomainEvents([...events].reverse());
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
  });
});
