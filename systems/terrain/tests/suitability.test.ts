import { describe, expect, it } from "vitest";
import type {
  PreparedWorldDefinition,
  StartingCandidate,
} from "@web-three-city/world";
import { evaluateStartingCandidates } from "../src/application/evaluate-starting-candidates";
import {
  prepareProductionTerrainInternal,
  type PrepareProductionTerrainDependencies,
} from "../src/application/prepare-production-terrain";
import { fingerprintProductionTerrainField } from "../src/domain/generation/fingerprint";
import { generateProductionTerrainField } from "../src/domain/generation/production-field";
import type { TerrainFieldSource } from "../src/contracts/terrain-composition";

const PRODUCTION_SEED = "0x5EED5EED5EED5EED";

function preparedWorld(): PreparedWorldDefinition {
  return {
    mapDefinition: {
      mapDefinitionId: "web-three-city-production",
      profileId: "production-v1",
      profileVersion: 1,
      widthCells: 512,
      heightCells: 512,
      cellSizeMeters: 8,
      logicalChunkSizeCells: 32,
      terrainGenerationProfileId: "balanced-temperate-generation",
      terrainGenerationProfileVersion: 2,
      regionIds: ["R06", "R08", "R11", "R13"],
      startingCandidates: [
        { regionId: "R06", anchor: { x: 153, z: 191 } },
        { regionId: "R08", anchor: { x: 358, z: 191 } },
        { regionId: "R11", anchor: { x: 153, z: 319 } },
        { regionId: "R13", anchor: { x: 358, z: 319 } },
      ],
      acceptedTerrainSeeds: [PRODUCTION_SEED],
    },
    spatial: {} as PreparedWorldDefinition["spatial"],
  };
}

describe("Terrain starting suitability", () => {
  it("matches the frozen production candidate vector exactly", () => {
    const world = preparedWorld();
    const field = generateProductionTerrainField(BigInt(PRODUCTION_SEED));

    expect(
      evaluateStartingCandidates(world.mapDefinition.startingCandidates, field),
    ).toEqual([
      {
        regionId: "R06",
        eligible: true,
        patchElevationRange: 8,
        maxCellCornerRange: 2,
        anchorCellCornerRange: 1,
        reasons: [],
      },
      {
        regionId: "R08",
        eligible: true,
        patchElevationRange: 11,
        maxCellCornerRange: 3,
        anchorCellCornerRange: 2,
        reasons: [],
      },
      {
        regionId: "R11",
        eligible: true,
        patchElevationRange: 6,
        maxCellCornerRange: 2,
        anchorCellCornerRange: 1,
        reasons: [],
      },
      {
        regionId: "R13",
        eligible: true,
        patchElevationRange: 20,
        maxCellCornerRange: 4,
        anchorCellCornerRange: 2,
        reasons: [],
      },
    ]);
  });

  it("reports synthetic failures in the frozen reason order", () => {
    const candidate: StartingCandidate = {
      regionId: "R99",
      anchor: { x: 3, z: 3 },
    };
    const field: TerrainFieldSource = {
      vertexWidth: 16,
      vertexHeight: 16,
      elevationAt(x, z) {
        return x * 10 + z * 10;
      },
    };

    expect(evaluateStartingCandidates([candidate], field)).toEqual([
      {
        regionId: "R99",
        eligible: false,
        patchElevationRange: 160,
        maxCellCornerRange: 20,
        anchorCellCornerRange: 20,
        reasons: [
          "TERRAIN_START_UNAVAILABLE",
          "TERRAIN_START_CELL_RELIEF_EXCEEDED",
          "TERRAIN_START_PATCH_RELIEF_EXCEEDED",
          "TERRAIN_START_ANCHOR_RELIEF_EXCEEDED",
        ],
      },
    ]);
  });
});

describe("production Terrain preparation", () => {
  it("prepares the selected accepted seed exactly once with frozen facts", () => {
    const world = preparedWorld();
    let generationCalls = 0;
    const dependencies: PrepareProductionTerrainDependencies = {
      generateField(seed64) {
        generationCalls += 1;
        return generateProductionTerrainField(seed64);
      },
      fingerprintField: fingerprintProductionTerrainField,
      evaluateCandidates: evaluateStartingCandidates,
    };

    const result = prepareProductionTerrainInternal(
      { world, seed64: PRODUCTION_SEED },
      dependencies,
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error(
        `unexpected Terrain preparation rejection: ${result.code}`,
      );
    }

    expect(generationCalls).toBe(1);
    expect(result.value.selectedSeed64).toBe(PRODUCTION_SEED);
    expect(result.value.fingerprint).toBe("0xF2FA29BFD2AEB069");
    expect(
      result.value.candidateEvaluations.map((entry) => entry.regionId),
    ).toEqual(["R06", "R08", "R11", "R13"]);
    expect(
      result.value.candidateEvaluations.every((entry) => entry.eligible),
    ).toBe(true);
  });

  it("rejects invalid and unaccepted seeds before generation", () => {
    const world = preparedWorld();
    let generationCalls = 0;
    const dependencies: PrepareProductionTerrainDependencies = {
      generateField(seed64) {
        generationCalls += 1;
        return generateProductionTerrainField(seed64);
      },
      fingerprintField: fingerprintProductionTerrainField,
      evaluateCandidates: evaluateStartingCandidates,
    };

    expect(
      prepareProductionTerrainInternal(
        { world, seed64: "5EED5EED5EED5EED" },
        dependencies,
      ),
    ).toMatchObject({
      status: "rejected",
      code: "TERRAIN_GENERATION_SEED_INVALID",
    });
    expect(
      prepareProductionTerrainInternal(
        { world, seed64: "0x0000000000000001" },
        dependencies,
      ),
    ).toMatchObject({
      status: "rejected",
      code: "TERRAIN_GENERATION_SEED_NOT_ACCEPTED",
    });
    expect(generationCalls).toBe(0);
  });

  it("does not mine another seed after a fingerprint rejection", () => {
    const world = preparedWorld();
    let generationCalls = 0;
    const dependencies: PrepareProductionTerrainDependencies = {
      generateField(seed64) {
        generationCalls += 1;
        return generateProductionTerrainField(seed64);
      },
      fingerprintField() {
        return "0x0000000000000000";
      },
      evaluateCandidates: evaluateStartingCandidates,
    };

    const result = prepareProductionTerrainInternal(
      { world, seed64: PRODUCTION_SEED },
      dependencies,
    );

    expect(result).toMatchObject({
      status: "rejected",
      code: "TERRAIN_GENERATION_FINGERPRINT_MISMATCH",
    });
    expect(generationCalls).toBe(1);
  });
});
