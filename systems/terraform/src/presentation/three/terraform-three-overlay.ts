import { logicalElevationToMeters } from "@web-three-city/terrain";
import type { CellCoord, ChunkCoord } from "@web-three-city/world";
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  type Material,
} from "three";
import type {
  CreateTerraformThreeOverlayInput,
  TerraformThreeOverlay,
} from "../../contracts/terraform-three";
import type { TerraformPreview } from "../../contracts/terraform-types";
import {
  buildTerraformCellHighlightLineData,
  buildTerraformGridChunkLineData,
  type TerraformLineData,
} from "./build-grid-chunk-geometry";
import { resolveTerraformThreeOverlayConfig } from "./overlay-config";

const POSITION_COMPONENTS = 3;

type SemanticLayer =
  | "grid"
  | "footprint"
  | "influence"
  | "invalid"
  | "flattenReference";
type TransientLayer = Exclude<SemanticLayer, "grid">;

interface LineResource {
  readonly object: LineSegments;
  readonly geometry: BufferGeometry;
  dispose(): void;
}

function chunkKey(chunk: ChunkCoord): string {
  return `${chunk.x}:${chunk.z}`;
}

function createMaterial(color: number, opacity: number): LineBasicMaterial {
  return new LineBasicMaterial({
    color,
    opacity,
    transparent: opacity < 1,
  });
}

function createLineResource(
  name: string,
  data: TerraformLineData,
  material: Material,
): LineResource {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(data.positions, POSITION_COMPONENTS),
  );
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const object = new LineSegments(geometry, material);
  object.name = name;
  let disposed = false;
  return Object.freeze({
    object,
    geometry,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
    },
  });
}

function disposeResources(resources: ReadonlyMap<string, LineResource>): void {
  for (const resource of resources.values()) resource.dispose();
}

function allLogicalChunks(
  input: CreateTerraformThreeOverlayInput,
): readonly ChunkCoord[] {
  const size = input.mapDefinition.logicalChunkSizeCells;
  const width = Math.ceil(input.mapDefinition.widthCells / size);
  const height = Math.ceil(input.mapDefinition.heightCells / size);
  const chunks: ChunkCoord[] = [];
  for (let z = 0; z < height; z += 1) {
    for (let x = 0; x < width; x += 1) chunks.push({ x, z });
  }
  return chunks;
}

function previewFootprint(preview: TerraformPreview): readonly CellCoord[] {
  if (preview.status === "valid") return preview.plan.footprintCells;
  if (preview.footprintCells.length > 0) return preview.footprintCells;
  return preview.targetCell === undefined ? [] : [preview.targetCell];
}

function previewIntersectsChunks(
  preview: TerraformPreview | undefined,
  dirty: ReadonlySet<string>,
  chunkSize: number,
): boolean {
  if (preview === undefined || dirty.size === 0) return false;
  const cells =
    preview.status === "valid"
      ? [...preview.plan.footprintCells, ...preview.plan.influenceCells]
      : previewFootprint(preview);
  return cells.some((cell) =>
    dirty.has(
      chunkKey({
        x: Math.floor(cell.x / chunkSize),
        z: Math.floor(cell.z / chunkSize),
      }),
    ),
  );
}

export function createTerraformThreeOverlayInternal(
  input: CreateTerraformThreeOverlayInput,
): TerraformThreeOverlay {
  if (input.terrain.completeness() !== "full") {
    throw new Error("Terraform Three overlay requires complete Terrain.");
  }

  const config = resolveTerraformThreeOverlayConfig(input.config);
  const root = new Group();
  root.name = "terraform-three-overlay";
  root.visible = false;
  const gridGroup = new Group();
  gridGroup.name = "terraform-three-layer:grid";
  const previewGroup = new Group();
  previewGroup.name = "terraform-three-layer:preview";
  root.add(gridGroup, previewGroup);

  const materials: Readonly<Record<SemanticLayer, LineBasicMaterial>> =
    Object.freeze({
      grid: createMaterial(config.gridColor, config.gridOpacity),
      footprint: createMaterial(config.footprintColor, config.footprintOpacity),
      influence: createMaterial(config.influenceColor, config.influenceOpacity),
      invalid: createMaterial(config.invalidColor, config.invalidOpacity),
      flattenReference: createMaterial(
        config.flattenReferenceColor,
        config.flattenReferenceOpacity,
      ),
    });

  const gridResources = new Map<string, LineResource>();
  const transientResources = new Map<TransientLayer, LineResource>();
  let currentPreview: TerraformPreview | undefined;
  let active = false;
  let disposed = false;

  const assertUsable = (): void => {
    if (disposed) throw new Error("Terraform Three overlay is disposed.");
  };

  const buildGridResource = (chunk: ChunkCoord): LineResource | undefined => {
    const data = buildTerraformGridChunkLineData({
      mapDefinition: input.mapDefinition,
      mapState: input.mapState,
      spatial: input.spatial,
      terrain: input.terrain,
      chunk,
      surfaceOffsetMeters: config.surfaceOffsetMeters,
    });
    if (data.segmentCount === 0) return undefined;
    return createLineResource(
      `terraform-grid-chunk:${chunk.x}:${chunk.z}`,
      data,
      materials.grid,
    );
  };

  const stageInitialGrid = (): Map<string, LineResource> => {
    const staged = new Map<string, LineResource>();
    try {
      for (const chunk of allLogicalChunks(input)) {
        const resource = buildGridResource(chunk);
        if (resource !== undefined) staged.set(chunkKey(chunk), resource);
      }
      return staged;
    } catch (error) {
      disposeResources(staged);
      throw error;
    }
  };

  const clearGrid = (): void => {
    for (const resource of gridResources.values()) {
      gridGroup.remove(resource.object);
      resource.dispose();
    }
    gridResources.clear();
  };

  const publishInitialGrid = (
    staged: ReadonlyMap<string, LineResource>,
  ): void => {
    for (const [key, resource] of staged) {
      gridResources.set(key, resource);
      gridGroup.add(resource.object);
    }
  };

  const buildFlattenReferenceData = (
    preview: TerraformPreview,
  ): TerraformLineData | undefined => {
    if (preview.status !== "valid" || preview.plan.operation !== "flatten") {
      return undefined;
    }
    const targetCell = preview.plan.targetCell;
    let targetElevation = preview.plan.edits[0]?.desiredElevation;
    if (targetElevation === undefined) {
      const fallback = input.terrain.elevationAt({
        x: targetCell.x,
        z: targetCell.z,
      });
      if (fallback.status !== "success") return undefined;
      targetElevation = fallback.value;
    }

    const x = (targetCell.x + 0.5) * input.mapDefinition.cellSizeMeters;
    const z = (targetCell.z + 0.5) * input.mapDefinition.cellSizeMeters;
    const y =
      logicalElevationToMeters(targetElevation) +
      config.surfaceOffsetMeters * 2;
    const half = config.flattenMarkerHalfSizeMeters;
    return Object.freeze({
      positions: new Float32Array([
        x - half,
        y,
        z,
        x + half,
        y,
        z,
        x,
        y,
        z - half,
        x,
        y,
        z + half,
      ]),
      cellCount: 1,
      segmentCount: 2,
    });
  };

  const stageTransient = (
    preview: TerraformPreview | undefined,
  ): Map<TransientLayer, LineResource> => {
    const staged = new Map<TransientLayer, LineResource>();
    const add = (layer: TransientLayer, data: TerraformLineData): void => {
      if (data.segmentCount === 0) return;
      staged.set(
        layer,
        createLineResource(`terraform-${layer}`, data, materials[layer]),
      );
    };
    try {
      if (preview === undefined) return staged;
      if (preview.status === "valid") {
        add(
          "footprint",
          buildTerraformCellHighlightLineData({
            mapDefinition: input.mapDefinition,
            terrain: input.terrain,
            cells: preview.plan.footprintCells,
            surfaceOffsetMeters: config.surfaceOffsetMeters * 2,
          }),
        );
        add(
          "influence",
          buildTerraformCellHighlightLineData({
            mapDefinition: input.mapDefinition,
            terrain: input.terrain,
            cells: preview.plan.influenceCells,
            surfaceOffsetMeters: config.surfaceOffsetMeters * 3,
          }),
        );
        const flatten = buildFlattenReferenceData(preview);
        if (flatten !== undefined) add("flattenReference", flatten);
      } else {
        add(
          "invalid",
          buildTerraformCellHighlightLineData({
            mapDefinition: input.mapDefinition,
            terrain: input.terrain,
            cells: previewFootprint(preview),
            surfaceOffsetMeters: config.surfaceOffsetMeters * 4,
          }),
        );
      }
      return staged;
    } catch (error) {
      disposeResources(staged);
      throw error;
    }
  };

  const clearTransient = (): void => {
    for (const resource of transientResources.values()) {
      previewGroup.remove(resource.object);
      resource.dispose();
    }
    transientResources.clear();
  };

  const publishTransient = (
    staged: ReadonlyMap<TransientLayer, LineResource>,
  ): void => {
    clearTransient();
    for (const [layer, resource] of staged) {
      transientResources.set(layer, resource);
      previewGroup.add(resource.object);
    }
  };

  const value: TerraformThreeOverlay = {
    root,
    setActive(next) {
      assertUsable();
      if (next === active) return;
      if (!next) {
        active = false;
        root.visible = false;
        clearTransient();
        clearGrid();
        return;
      }

      const stagedGrid = stageInitialGrid();
      let stagedPreview: Map<TransientLayer, LineResource> | undefined;
      try {
        stagedPreview = stageTransient(currentPreview);
      } catch (error) {
        disposeResources(stagedGrid);
        throw error;
      }
      publishInitialGrid(stagedGrid);
      publishTransient(stagedPreview);
      active = true;
      root.visible = true;
    },
    setPreview(preview) {
      assertUsable();
      if (!active) {
        currentPreview = preview;
        return;
      }
      const staged = stageTransient(preview);
      publishTransient(staged);
      currentPreview = preview;
    },
    rebuild(invalidation) {
      assertUsable();
      if (!active) return;
      const dirtyChunks = new Map<string, ChunkCoord>();
      for (const chunk of invalidation.touchingLogicalChunks) {
        dirtyChunks.set(chunkKey(chunk), chunk);
      }
      const dirty = new Set(dirtyChunks.keys());
      const stagedGrid = new Map<string, LineResource | undefined>();
      let stagedPreview: Map<TransientLayer, LineResource> | undefined;
      try {
        for (const [key, chunk] of dirtyChunks) {
          stagedGrid.set(key, buildGridResource(chunk));
        }
        if (
          previewIntersectsChunks(
            currentPreview,
            dirty,
            input.mapDefinition.logicalChunkSizeCells,
          )
        ) {
          stagedPreview = stageTransient(currentPreview);
        }
      } catch (error) {
        for (const resource of stagedGrid.values()) resource?.dispose();
        stagedPreview?.forEach((resource) => resource.dispose());
        throw error;
      }

      for (const [key, replacement] of stagedGrid) {
        const old = gridResources.get(key);
        if (old !== undefined) {
          gridGroup.remove(old.object);
          old.dispose();
          gridResources.delete(key);
        }
        if (replacement !== undefined) {
          gridResources.set(key, replacement);
          gridGroup.add(replacement.object);
        }
      }
      if (stagedPreview !== undefined) publishTransient(stagedPreview);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTransient();
      clearGrid();
      for (const material of Object.values(materials)) material.dispose();
      root.clear();
      root.visible = false;
    },
  };

  return Object.freeze(value);
}
