import { describe, expect, expectTypeOf, test } from 'vitest';
import type { CommandRejection, CommandResult, IntegrationEvent } from '../src/index';

interface Denied extends CommandRejection {
  readonly code: 'denied';
  readonly reason: string;
}

function consumeResult(result: CommandResult<number, Denied>): number | string {
  if (result.status === 'success') return result.value;
  return result.rejection.reason;
}

describe('foundation contract primitives', () => {
  test('CommandResult narrows success and typed rejection branches', () => {
    const success: CommandResult<number, Denied> = { status: 'success', value: 7 };
    const rejected: CommandResult<number, Denied> = {
      status: 'rejected',
      rejection: { code: 'denied', message: 'Denied', reason: 'fixture' }
    };

    expect(consumeResult(success)).toBe(7);
    expect(consumeResult(rejected)).toBe('fixture');
    expectTypeOf(success.status).toEqualTypeOf<'success'>();
    expectTypeOf(rejected.status).toEqualTypeOf<'rejected'>();
  });

  test('IntegrationEvent keeps owner-provided identity and payload values readonly at the public type boundary', () => {
    type Payload = { readonly roadId: string };
    const event: IntegrationEvent<'fixture.road-built', Payload> = {
      type: 'fixture.road-built',
      payload: { roadId: 'road-1' },
      occurredAt: '2026-08-28T00:00:00.000Z',
      sequence: 1
    };

    expect(event.type).toBe('fixture.road-built');
    expect(event.payload.roadId).toBe('road-1');
    expectTypeOf(event.type).toEqualTypeOf<'fixture.road-built'>();
    expectTypeOf(event.payload).toMatchTypeOf<Readonly<Payload>>();
  });
});
