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
  generateProductionTerrainField,
  type ProductionTerrainField,
} from "../domain/generation/production-field";
import { evaluateStartingCandidates } from "./evaluate-starting-candidates";

const PRODUCTION_PROFILE_ID = "balanced-temperate-generation";
const PRODUCTION_PROFILE_VERSION = 2;
const PRODUCTION_VERTEX_AXIS_COUNT = 513;
const MIN_PRODUCTION_ELEVATION = 32;
const MAX_PRODUCTION_ELEVATION = 288;
const EXPECTED_FINGERPRINT = "0xF2FA29BFD2AEB069";
const SEED64_PATTERN = /^0x[0-9a-fA-F]{16}$/;

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

function canonicalSeed64(seed64: string): string | undefined {
  if (!SEED64_PATTERN.test(seed64)) return undefined;
  return `0x${seed64.slice(2).toUpperCase()}`;
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
        elevation < MIN_PRODUCTION_ELEVATION ||
        elevation > MAX_PRODUCTION_ELEVATION
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
    definition.terrainGenerationProfileId !== PRODUCTION_PROFILE_ID ||
    definition.terrainGenerationProfileVersion !== PRODUCTION_PROFILE_VERSION
  ) {
    return reject("TERRAIN_GENERATION_PROFILE_UNSUPPORTED");
  }

  const selectedSeed64 = canonicalSeed64(input.seed64);
  if (selectedSeed64 === undefined) {
    return reject("TERRAIN_GENERATION_SEED_INVALID");
  }
  if (!definition.acceptedTerrainSeeds.includes(selectedSeed64)) {
    return reject("TERRAIN_GENERATION_SEED_NOT_ACCEPTED");
  }

  const field = dependencies.generateField(BigInt(selectedSeed64));
  if (!validateProductionEnvelope(field)) {
    return reject("TERRAIN_GENERATION_OUTPUT_OUT_OF_RANGE");
  }

  const fingerprint = dependencies.fingerprintField(field);
  if (fingerprint !== EXPECTED_FINGERPRINT) {
    return reject("TERRAIN_GENERATION_FINGERPRINT_MISMATCH", {
      expected: EXPECTED_FINGERPRINT,
      actual: fingerprint,
    });
  }

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
