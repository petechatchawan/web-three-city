import { RciContractError } from '../contracts/errors.js';
import { compareStableId } from '../contracts/ids.js';
import type { DefinitionRegistry } from './contracts.js';

export function createDefinitionRegistry<T extends Readonly<{ id: string }>>(
  definitions: readonly T[],
  validateReference?: (definition: T, has: (id: string) => boolean) => void,
): DefinitionRegistry<T> {
  const sorted = definitions
    .map((definition) => {
      if (definition.id.length === 0 || definition.id.trim() !== definition.id) {
        throw new RciContractError('rci:unknown-definition');
      }
      return Object.freeze({ ...definition }) as T;
    })
    .sort((first, second) => compareStableId(first.id, second.id));

  const byId = new Map<string, T>();
  for (const definition of sorted) {
    if (byId.has(definition.id)) {
      throw new RciContractError('rci:unknown-definition');
    }
    byId.set(definition.id, definition);
  }

  const values = Object.freeze([...sorted]);
  const has = (id: string): boolean => byId.has(id);
  for (const definition of values) {
    validateReference?.(definition, has);
  }

  return Object.freeze({
    get(id: string): T {
      const definition = byId.get(id);
      if (definition === undefined) {
        throw new RciContractError('rci:unknown-definition');
      }
      return definition;
    },
    has,
    values(): readonly T[] {
      return values;
    },
  });
}
