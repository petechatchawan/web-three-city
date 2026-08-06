import { describe, expect, it } from 'vitest';
import { RciContractError, canonicalCitizenPair } from '../src/index.js';

describe('RCI foundation contracts', () => {
  it('canonicalizes undirected citizen pairs lexically', () => {
    expect(canonicalCitizenPair('citizen:12', 'citizen:2')).toEqual(['citizen:12', 'citizen:2']);
  });

  it('rejects self relationships', () => {
    expect(() => canonicalCitizenPair('citizen:1', 'citizen:1')).toThrowError(
      new RciContractError('rci:invalid-relationship'),
    );
  });
});
