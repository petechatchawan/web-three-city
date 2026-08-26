import { describe, expect, it } from 'vitest';
import { orderRciDomainEvents, type RciDomainEvent } from '../src/index.js';
import { macroHour } from './temporal-fixtures.js';

const events: readonly RciDomainEvent[] = [
  {
    type: 'citizen.died',
    macroHourIndex: macroHour(32),
    priority: 40,
    entityKind: 'citizen',
    entityId: 'citizen:2',
    sequence: 2,
  },
  {
    type: 'citizen.born',
    macroHourIndex: macroHour(32),
    priority: 30,
    entityKind: 'citizen',
    entityId: 'citizen:3',
    sequence: 3,
  },
  {
    type: 'citizen.reached-age-band',
    macroHourIndex: macroHour(32),
    priority: 10,
    entityKind: 'citizen',
    entityId: 'citizen:1',
    sequence: 1,
    ageBandDefinitionId: 'age-band.working-age',
  },
];

describe('RCI domain event ordering', () => {
  it('orders by macroHourIndex, priority, entity kind, stable id, and sequence', () => {
    const ordered = orderRciDomainEvents(events);
    expect(ordered.map((event) => event.priority)).toEqual([10, 30, 40]);
    expect(ordered.map((event) => event.type)).toEqual([
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
