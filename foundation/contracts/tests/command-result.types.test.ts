import { describe, expect, expectTypeOf, it } from 'vitest';
import type { CommandRejection, CommandResult } from '../src/index.js';

type Rejection = CommandRejection<'not-allowed'>;

describe('CommandResult', () => {
  it('narrows success and rejection branches without exposing mutable owner state', () => {
    const result: CommandResult<Readonly<{ value: number }>, Rejection> = {
      ok: true,
      value: { value: 7 },
    };

    if (result.ok) {
      expect(result.value.value).toBe(7);
      expectTypeOf(result.value).toEqualTypeOf<Readonly<{ value: number }>>();
    } else {
      expectTypeOf(result.rejection.code).toEqualTypeOf<'not-allowed'>();
    }
  });
});
