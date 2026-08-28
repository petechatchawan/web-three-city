import { describe, expect, expectTypeOf, it } from 'vitest';
import type { IntegrationEvent } from '../src/index.js';

describe('IntegrationEvent', () => {
  it('carries only generic type and payload semantics', () => {
    const event: IntegrationEvent<'example.changed', Readonly<{ id: string }>> = {
      type: 'example.changed',
      payload: { id: 'a-1' },
    };

    expect(event.type).toBe('example.changed');
    expectTypeOf(event.payload).toEqualTypeOf<Readonly<{ id: string }>>();
    expect('timestamp' in event).toBe(false);
    expect('eventId' in event).toBe(false);
  });
});
