import { describe, expect, it } from 'vitest';
import { RciContractError, createFoundationRciRegistries } from '../src/index.js';
import { createDefinitionRegistry } from '../src/definitions/definition-registry.js';

describe('RCI definition registry', () => {
  it('sorts and freezes definitions by stable id', () => {
    const registry = createDefinitionRegistry([
      { id: 'definition:z', value: 2 },
      { id: 'definition:a', value: 1 },
    ]);

    expect(registry.values()).toEqual([
      { id: 'definition:a', value: 1 },
      { id: 'definition:z', value: 2 },
    ]);
    expect(Object.isFrozen(registry.values())).toBe(true);
    expect(Object.isFrozen(registry.get('definition:a'))).toBe(true);
  });

  it('rejects empty and duplicate ids', () => {
    expect(() => createDefinitionRegistry([{ id: '' }])).toThrowError(
      new RciContractError('rci:unknown-definition'),
    );
    expect(() => createDefinitionRegistry([{ id: 'same' }, { id: 'same' }])).toThrowError(
      new RciContractError('rci:unknown-definition'),
    );
  });

  it('rejects missing definitions and dangling references', () => {
    const registry = createDefinitionRegistry([{ id: 'known' }]);
    expect(() => registry.get('missing')).toThrowError(
      new RciContractError('rci:unknown-definition'),
    );

    expect(() =>
      createDefinitionRegistry(
        [{ id: 'definition:a', referenceId: 'definition:missing' }],
        (definition, has) => {
          if (!has(definition.referenceId)) {
            throw new RciContractError('rci:unknown-definition');
          }
        },
      ),
    ).toThrowError(new RciContractError('rci:unknown-definition'));
  });

  it('constructs the validated foundation content registries', () => {
    const registries = createFoundationRciRegistries();

    expect(registries.sexes.values().map((definition) => definition.id)).toEqual([
      'sex.female',
      'sex.male',
    ]);
    expect(registries.qualifications.values().map((definition) => definition.rank)).toEqual([
      10, 20, 30,
    ]);
    for (const requirement of registries.employmentRequirements.values()) {
      expect(registries.qualifications.has(requirement.minimumQualificationDefinitionId)).toBe(
        true,
      );
    }
  });
});
