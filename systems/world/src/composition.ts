import type {
  CreateInitialWorldInput,
  PreparedWorldDefinition,
  RestoreWorldInput,
  WorldConstructionResult,
  WorldSystem,
} from "./contracts/world-read";
import { prepareProductionWorldDefinition as prepareProductionWorldDefinitionInternal } from "./application/prepare-world-definition";
import {
  createWorldInternal,
  restoreWorldInternal,
} from "./composition/create-world";

function prepareDefinition(): WorldConstructionResult<PreparedWorldDefinition> {
  return prepareProductionWorldDefinitionInternal();
}

export function prepareProductionWorldDefinition(): WorldConstructionResult<PreparedWorldDefinition> {
  return prepareDefinition();
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

function constructRestoredWorld(
  input: RestoreWorldInput,
): WorldConstructionResult<WorldSystem> {
  return restoreWorldInternal(input);
}

export function restoreWorldSystem(
  input: RestoreWorldInput,
): WorldConstructionResult<WorldSystem> {
  return constructRestoredWorld(input);
}
