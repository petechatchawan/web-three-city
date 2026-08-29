import type { StartingCandidate } from "@web-three-city/world";
import type {
  PrepareProductionTerrainInput,
  PreparedProductionTerrain,
  StartingCandidateEvaluation,
  TerrainGenerationRejectionCode,
  TerrainGenerationResult,
} from "../contracts/generation";
import type { TerrainFieldSource } from "../contracts/terrain-composition";
import { fingerprintProductionTerrainField } from "../domain/generation/fingerprint";
import {
  canonicalTerrainSeed64,
  TERRAIN_GENERATION_MAX_ELEVATION,
  TERRAIN_GENERATION_MIN_ELEVATION,
  TERRAIN_GENERATION_PROFILE_ID,
  TERRAIN_GENERATION_PROFILE_VERSION,
} from "../domain/generation/profile";
import {
  generateProductionTerrainField,
  type ProductionTerrainField,
} from "../domain/generation/production-field";
import { evaluateStartingCandidates } from "./evaluate-starting-candidates";

const PRODUCTION_VERTEX_AXIS_COUNT = 513;

export interface PrepareProductionTerrainDependencies {
  generateField(seed64: bigint): ProductionTerrainField;
  fingerprintField(field: ProductionTerrainField): string;
  evaluateCandidates(
    candidates: readonly StartingCandidate[],
    field: TerrainFieldSource,
  ): readonly StartingCandidateEvaluation[];
}

const PRODUCTION_DEPENDENCIES: PrepareProductionTerrainDependencies = {
  generateField: generateProductionTerrainField,
  fingerprintField: fingerprintProductionTerrainField,
  evaluateCandidates: evaluateStartingCandidates,
};

function reject<T>(
  code: TerrainGenerationRejectionCode,
  detail?: Readonly<Record<string, unknown>>,
): TerrainGenerationResult<T> {
  return detail === undefined
    ? { status: "rejected", code }
    : { status: "rejected", code, detail: Object.freeze({ ...detail }) };
}

function validateProductionEnvelope(field: TerrainFieldSource): boolean {
  if (
    field.vertexWidth !== PRODUCTION_VERTEX_AXIS_COUNT ||
    field.vertexHeight !== PRODUCTION_VERTEX_AXIS_COUNT
  ) {
    return false;
  }

  for (let z = 0; z < field.vertexHeight; z += 1) {
    for (let x = 0; x < field.vertexWidth; x += 1) {
      const elevation = field.elevationAt(x, z);
      if (
        !Number.isInteger(elevation) ||
        elevation < TERRAIN_GENERATION_MIN_ELEVATION ||
        elevation > TERRAIN_GENERATION_MAX_ELEVATION
      ) {
        return false;
      }
    }
  }

  return true;
}

export function prepareProductionTerrainInternal(
  input: PrepareProductionTerrainInput,
  dependencies: PrepareProductionTerrainDependencies = PRODUCTION_DEPENDENCIES,
): TerrainGenerationResult<PreparedProductionTerrain> {
  const definition = input.world.mapDefinition;
  if (
    definition.terrainGenerationProfileId !== TERRAIN_GENERATION_PROFILE_ID ||
    definition.terrainGenerationProfileVersion !==
      TERRAIN_GENERATION_PROFILE_VERSION
  ) {
    return reject("TERRAIN_GENERATION_PROFILE_UNSUPPORTED");
  }

  const selectedSeed64 = canonicalTerrainSeed64(input.seed64);
  if (selectedSeed64 === undefined) {
    return reject("TERRAIN_GENERATION_SEED_INVALID");
  }
  const field = dependencies.generateField(BigInt(selectedSeed64));
  if (!validateProductionEnvelope(field)) {
    return reject("TERRAIN_GENERATION_OUTPUT_OUT_OF_RANGE");
  }

  const fingerprint = dependencies.fingerprintField(field);

  const candidateEvaluations = dependencies.evaluateCandidates(
    definition.startingCandidates,
    field,
  );
  if (!candidateEvaluations.some((evaluation) => evaluation.eligible)) {
    return reject("TERRAIN_GENERATION_NO_ELIGIBLE_START");
  }

  return {
    status: "success",
    value: Object.freeze({
      field,
      selectedSeed64,
      fingerprint,
      candidateEvaluations: Object.freeze([...candidateEvaluations]),
    }),
  };
}
