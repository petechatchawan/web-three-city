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
      bornAtMacroHourIndex: ageOriginMacroHour(-8_640),
      movedIntoCityAtMacroHourIndex: macroHour(0),
      movedOutOfCityAtMacroHourIndex: null,
      diedAtMacroHourIndex: null,
    });

    expect(citizen).toEqual({
      citizenId: 'citizen:1',
      presence: 'resident',
      sexDefinitionId: 'sex.female',
      bornAtMacroHourIndex: ageOriginMacroHour(-8_640),
      movedIntoCityAtMacroHourIndex: macroHour(0),
      movedOutOfCityAtMacroHourIndex: null,
      diedAtMacroHourIndex: null,
    });
    expect(Object.isFrozen(citizen)).toBe(true);
  });
});
import { ageOriginMacroHour, macroHour } from './temporal-fixtures.js';
