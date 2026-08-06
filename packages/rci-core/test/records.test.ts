import { describe, expect, it } from 'vitest';
import { RciContractError, type CitizenRecord } from '../src/index.js';
import { canonicalCitizenPair } from '../src/contracts/ids.js';

describe('RCI foundation contracts', () => {
  it('canonicalizes undirected citizen pairs lexically', () => {
    expect(canonicalCitizenPair('citizen:12', 'citizen:2')).toEqual(['citizen:12', 'citizen:2']);
  });

  it('rejects self relationships', () => {
    expect(() => canonicalCitizenPair('citizen:1', 'citizen:1')).toThrowError(
      new RciContractError('rci:invalid-relationship'),
    );
  });

  it('supports normalized immutable citizen records', () => {
    const citizen: CitizenRecord = Object.freeze({
      citizenId: 'citizen:1',
      presence: 'resident',
      sexDefinitionId: 'sex.female',
      bornAtTick: -8_640,
      movedIntoCityAtTick: 0,
      movedOutOfCityAtTick: null,
      diedAtTick: null,
    });

    expect(citizen).toEqual({
      citizenId: 'citizen:1',
      presence: 'resident',
      sexDefinitionId: 'sex.female',
      bornAtTick: -8_640,
      movedIntoCityAtTick: 0,
      movedOutOfCityAtTick: null,
      diedAtTick: null,
    });
    expect(Object.isFrozen(citizen)).toBe(true);
  });
});
