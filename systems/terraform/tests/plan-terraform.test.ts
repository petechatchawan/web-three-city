import { describe, expect, it } from "vitest";
import type {
  CellCoord,
  MapDefinitionRead,
  MapStateRead,
  RegionId,
  VertexCoord,
  WorldSpatialRead,
} from "@web-three-city/world";
import {
  parseLogicalElevation,
  type LogicalElevation,
  type TerrainAuthorityRead,
  type TerrainRevision,
} from "@web-three-city/terrain";
import type {
  PlanTerraformInput,
  TerraformPreview,
} from "@web-three-city/terraform";
import { planTerraform } from "@web-three-city/terraform/composition";

const UNLOCKED = "region-unlocked" as RegionId;
const LOCKED = "region-locked" as RegionId;

const mapDefinition: MapDefinitionRead = {
  mapDefinitionId: "web-three-city-production",
  profileId: "production-v1",
  profileVersion: 1,
  widthCells: 512,
  heightCells: 512,
  cellSizeMeters: 8,
  logicalChunkSizeCells: 32,
  terrainGenerationProfileId: "balanced-temperate-generation",
  terrainGenerationProfileVersion: 2,
  regionIds: [UNLOCKED, LOCKED],
  startingCandidates: [],
};

const mapState: MapStateRead = {
  mapDefinitionId: "web-three-city-production",
  startingRegionId: UNLOCKED,
  unlockedRegionIds: [UNLOCKED],
};

function elevation(value: number): LogicalElevation {
  const parsed = parseLogicalElevation(value);
  if (parsed.status !== "success")
    throw new Error(`invalid test elevation ${value}`);
  return parsed.value;
}

function spatial(options?: { readonly lockedCell?: string }): WorldSpatialRead {
  return {
    regionAtCell(cell: CellCoord) {
      return {
        status: "success",
        value:
          `${cell.x}:${cell.z}` === options?.lockedCell ? LOCKED : UNLOCKED,
      };
    },
    incidentCells(vertex: VertexCoord) {
      const cells = [
        { x: vertex.x - 1, z: vertex.z - 1 },
        { x: vertex.x, z: vertex.z - 1 },
        { x: vertex.x - 1, z: vertex.z },
        { x: vertex.x, z: vertex.z },
      ].filter(
        (cell) =>
          cell.x >= 0 &&
          cell.z >= 0 &&
          cell.x < mapDefinition.widthCells &&
          cell.z < mapDefinition.heightCells,
      );
      return { status: "success", value: cells };
    },
  } as unknown as WorldSpatialRead;
}

function terrain(options?: {
  readonly defaultElevation?: number;
  readonly unavailableVertex?: string;
}): TerrainAuthorityRead {
  const revision = 7 as TerrainRevision;
  return {
    revision: () => revision,
    completeness: () => "full",
    elevationAt(vertex: VertexCoord) {
      if (`${vertex.x}:${vertex.z}` === options?.unavailableVertex) {
        return {
          status: "unavailable",
          code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE",
          chunk: { x: 0, z: 0 },
        };
      }
      return {
        status: "success",
        value: elevation(options?.defaultElevation ?? 20),
      };
    },
  } as unknown as TerrainAuthorityRead;
}

function plan(overrides: Partial<PlanTerraformInput> = {}): TerraformPreview {
  return planTerraform({
    operation: "raise",
    targetCell: { x: 10, z: 10 },
    brushSize: 1,
    strength: "normal",
    mapDefinition,
    mapState,
    spatial: spatial(),
    terrain: terrain(),
    ...overrides,
  });
}

describe("planTerraform raise/lower", () => {
  it("plans a valid Normal 1x1 Raise against the captured Terrain revision", () => {
    const preview = plan();

    expect(preview.status).toBe("valid");
    if (preview.status !== "valid") return;

    expect(preview.plan.edits).toHaveLength(4);
    expect(
      preview.plan.edits.every((edit) => edit.desiredElevation === 24),
    ).toBe(true);
    expect(preview.plan.expectedTerrainRevision).toBe(7);
    expect(preview.plan.influenceCells).not.toContainEqual({ x: 10, z: 10 });
    expect(preview.plan.influenceCells).toEqual([
      { x: 9, z: 9 },
      { x: 10, z: 9 },
      { x: 11, z: 9 },
      { x: 9, z: 10 },
      { x: 11, z: 10 },
      { x: 9, z: 11 },
      { x: 10, z: 11 },
      { x: 11, z: 11 },
    ]);
  });

  it("rejects a 5x5 footprint that crosses the World boundary", () => {
    expect(plan({ targetCell: { x: 0, z: 0 }, brushSize: 5 })).toMatchObject({
      status: "invalid",
      reason: "OUT_OF_WORLD",
    });
  });

  it("rejects the whole footprint when one selected cell belongs to a locked region", () => {
    expect(
      plan({ brushSize: 3, spatial: spatial({ lockedCell: "11:10" }) }),
    ).toMatchObject({
      status: "invalid",
      reason: "LOCKED_REGION",
    });
  });

  it("rejects when one required canonical vertex is unavailable", () => {
    expect(
      plan({ terrain: terrain({ unavailableVertex: "11:11" }) }),
    ).toMatchObject({
      status: "invalid",
      reason: "TERRAIN_UNAVAILABLE",
    });
  });

  it("rejects Strong Raise that exceeds the Terrain logical elevation maximum", () => {
    expect(
      plan({
        strength: "strong",
        terrain: terrain({ defaultElevation: 4090 }),
      }),
    ).toMatchObject({ status: "invalid", reason: "ELEVATION_LIMIT" });
  });

  it("rejects Strong Lower that exceeds the Terrain logical elevation minimum", () => {
    expect(
      plan({
        operation: "lower",
        strength: "strong",
        terrain: terrain({ defaultElevation: -4090 }),
      }),
    ).toMatchObject({ status: "invalid", reason: "ELEVATION_LIMIT" });
  });
});

describe("planTerraform flatten", () => {
  it("rejects Flatten when no canonical target level has been selected", () => {
    expect(plan({ operation: "flatten" })).toMatchObject({
      status: "invalid",
      reason: "FLATTEN_TARGET_NOT_SELECTED",
    });
  });

  it("sets every changed footprint vertex to the exact canonical target", () => {
    const preview = plan({
      operation: "flatten",
      flattenTarget: elevation(31),
      terrain: terrain({ defaultElevation: 20 }),
    });

    expect(preview.status).toBe("valid");
    if (preview.status !== "valid") return;
    expect(preview.plan.edits).toHaveLength(4);
    expect(
      preview.plan.edits.every((edit) => edit.desiredElevation === 31),
    ).toBe(true);
  });

  it("returns a valid zero-edit plan when the footprint is already flat at target", () => {
    const preview = plan({
      operation: "flatten",
      flattenTarget: elevation(31),
      terrain: terrain({ defaultElevation: 31 }),
    });

    expect(preview.status).toBe("valid");
    if (preview.status !== "valid") return;
    expect(preview.plan.edits).toHaveLength(0);
    expect(preview.plan.influenceCells).toHaveLength(0);
  });

  it.each(["fine", "normal", "strong"] as const)(
    "ignores %s strength and preserves the same Flatten target",
    (strength) => {
      const preview = plan({
        operation: "flatten",
        strength,
        flattenTarget: elevation(31),
        terrain: terrain({ defaultElevation: 20 }),
      });

      expect(preview.status).toBe("valid");
      if (preview.status !== "valid") return;
      expect(
        preview.plan.edits.every((edit) => edit.desiredElevation === 31),
      ).toBe(true);
    },
  );
});
