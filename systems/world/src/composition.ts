import type {
  CreateInitialWorldInput,
  PreparedWorldDefinition,
  WorldConstructionResult,
  WorldSystem,
} from "./contracts/world-read";
import { prepareProductionWorldDefinition as prepareProductionWorldDefinitionInternal } from "./application/prepare-world-definition";
import { createWorldInternal } from "./composition/create-world";

export function prepareProductionWorldDefinition(): WorldConstructionResult<PreparedWorldDefinition> {
  return prepareProductionWorldDefinitionInternal();
}

function constructInitialWorld(
  input: CreateInitialWorldInput,
): WorldConstructionResult<WorldSystem> {
  return createWorldInternal(input);
}

export function createInitialWorldSystem(
  input: CreateInitialWorldInput,
): WorldConstructionResult<WorldSystem> {
  return constructInitialWorld(input);
}
