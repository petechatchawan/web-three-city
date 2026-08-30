import { describe, expect, it } from "vitest";
import type {
  MapDefinitionRead,
  MapStateRead,
  RegionId,
  WorldSpatialRead,
} from "@web-three-city/world";
import {
  parseLogicalElevation,
  type TerrainAuthorityRead,
  type TerrainRevision,
} from "@web-three-city/terrain";
import { buildBrushFootprint } from "@web-three-city/terraform";
import { planTerraform } from "@web-three-city/terraform/composition";

const UNLOCKED = "region-unlocked" as RegionId;

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
  regionIds: [UNLOCKED],
  startingCandidates: [],
};

const mapState: MapStateRead = {
  mapDefinitionId: "web-three-city-production",
  startingRegionId: UNLOCKED,
  unlockedRegionIds: [UNLOCKED],
};

const elevation = parseLogicalElevation(20);
if (elevation.status !== "success") {
  throw new Error("test elevation must be valid");
}

const spatial = {
  regionAtCell: () => ({ status: "success" as const, value: UNLOCKED }),
  incidentCells: () => ({ status: "success" as const, value: [] }),
} as unknown as WorldSpatialRead;

const terrain = {
  revision: () => 7 as TerrainRevision,
  completeness: () => "full" as const,
  elevationAt: () => ({ status: "success" as const, value: elevation.value }),
} as unknown as TerrainAuthorityRead;

describe("Terraform immutable planning contracts", () => {
  it("deep-freezes brush cell and vertex coordinates", () => {
    const footprint = buildBrushFootprint({ x: 10, z: 20 }, 3);

    expect(Object.isFrozen(footprint)).toBe(true);
    expect(Object.isFrozen(footprint.cells)).toBe(true);
    expect(footprint.cells.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(footprint.vertices)).toBe(true);
    expect(footprint.vertices.every(Object.isFrozen)).toBe(true);
  });

  it("deep-freezes coordinates exposed by a valid Terraform plan", () => {
    const preview = planTerraform({
      operation: "raise",
      targetCell: { x: 10, z: 10 },
      brushSize: 1,
      strength: "normal",
      mapDefinition,
      mapState,
      spatial,
      terrain,
    });

    expect(preview.status).toBe("valid");
    if (preview.status !== "valid") return;

    expect(Object.isFrozen(preview)).toBe(true);
    expect(Object.isFrozen(preview.plan)).toBe(true);
    expect(Object.isFrozen(preview.plan.targetCell)).toBe(true);
    expect(Object.isFrozen(preview.plan.footprintCells)).toBe(true);
    expect(preview.plan.footprintCells.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(preview.plan.edits)).toBe(true);
    expect(preview.plan.edits.every(Object.isFrozen)).toBe(true);
    expect(preview.plan.edits.every((edit) => Object.isFrozen(edit.vertex))).toBe(
      true,
    );
  });

  it("deep-freezes coordinates exposed by an invalid Terraform preview", () => {
    const preview = planTerraform({
      operation: "raise",
      targetCell: { x: 0, z: 0 },
      brushSize: 5,
      strength: "normal",
      mapDefinition,
      mapState,
      spatial,
      terrain,
    });

    expect(preview.status).toBe("invalid");
    if (preview.status !== "invalid") return;

    expect(Object.isFrozen(preview)).toBe(true);
    expect(Object.isFrozen(preview.targetCell)).toBe(true);
    expect(Object.isFrozen(preview.footprintCells)).toBe(true);
    expect(preview.footprintCells.every(Object.isFrozen)).toBe(true);
  });
});
