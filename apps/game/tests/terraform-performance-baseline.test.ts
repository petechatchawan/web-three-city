import { LineSegments, type Group } from "three";
import { describe, expect, it } from "vitest";
import {
  logicalElevationToMeters,
  type LogicalElevation,
} from "@web-three-city/terrain";
import {
  createTerrainThreeDebugOverlay,
  createTerrainThreeProjection,
} from "@web-three-city/terrain/composition";
import {
  type TerraformBrushSize,
  type TerraformPreview,
} from "@web-three-city/terraform";
import {
  createTerraformThreeOverlay,
  createTerraformUndoHistory,
  planTerraform,
} from "@web-three-city/terraform/composition";
import { createTerrainLifecycleAdapter } from "../src/composition/systems/terrain-lifecycle-adapter";
import { createWorldLifecycleAdapter } from "../src/composition/systems/world-lifecycle-adapter";
import { createTerraformRuntime } from "../src/composition/terraform/create-terraform-runtime";

const GOLDEN_SEED = "0x5EED5EED5EED5EED";
const TARGET_CELL = Object.freeze({ x: 153, z: 191 });

function environmentFlag(name: string): boolean {
  const processValue = Reflect.get(globalThis, "process");
  if (typeof processValue !== "object" || processValue === null) return false;
  const environment = Reflect.get(processValue, "env");
  if (typeof environment !== "object" || environment === null) return false;
  return Reflect.get(environment, name) === "1";
}

const BASELINE_ENABLED = environmentFlag("TERRAFORM_PERFORMANCE_BASELINE");

function timed<T>(operation: () => T): {
  readonly value: T;
  readonly milliseconds: number;
} {
  const started = performance.now();
  const value = operation();
  return Object.freeze({ value, milliseconds: performance.now() - started });
}

function byteLength(value: unknown): number {
  if (
    typeof value === "object" &&
    value !== null &&
    "byteLength" in value &&
    typeof (value as { readonly byteLength?: unknown }).byteLength === "number"
  ) {
    return (value as { readonly byteLength: number }).byteLength;
  }
  return 0;
}

function overlayFacts(root: Group) {
  let lineObjectCount = 0;
  let geometryBufferBytes = 0;
  const geometries = new Set<unknown>();
  const materials = new Set<unknown>();
  root.traverse((object) => {
    if (!(object instanceof LineSegments)) return;
    lineObjectCount += 1;
    geometries.add(object.geometry);
    const materialList = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materialList) materials.add(material);
    for (const attribute of Object.values(object.geometry.attributes)) {
      const storage = attribute as unknown as {
        readonly array?: unknown;
        readonly data?: { readonly array?: unknown };
      };
      geometryBufferBytes += byteLength(storage.array ?? storage.data?.array);
    }
    const index = object.geometry.getIndex();
    if (index !== null) geometryBufferBytes += byteLength(index.array);
  });
  return Object.freeze({
    lineObjectCount,
    geometryCount: geometries.size,
    materialCount: materials.size,
    geometryBufferBytes,
  });
}

function requireValid(preview: TerraformPreview) {
  if (preview.status !== "valid") {
    throw new Error(`Expected valid Terraform plan, got ${preview.reason}.`);
  }
  return preview.plan;
}

describe("Terraform performance baseline", () => {
  it.skipIf(!BASELINE_ENABLED)(
    "records planning, mutation, Undo and overlay resource measurements",
    () => {
      const worldAdapter = createWorldLifecycleAdapter();
      const terrainAdapter = createTerrainLifecycleAdapter();
      const preparedWorld = worldAdapter.prepareDefinition();
      if (preparedWorld.status !== "success") {
        throw new Error(`World prepare failed: ${preparedWorld.code}`);
      }
      const preparedTerrain = terrainAdapter.prepare(
        preparedWorld.value,
        GOLDEN_SEED,
      );
      if (preparedTerrain.status !== "success") {
        throw new Error(`Terrain prepare failed: ${preparedTerrain.code}`);
      }
      const world = worldAdapter.createInitial({
        prepared: preparedWorld.value,
        selectedStartingRegionId: "R06",
        eligibleStartingRegionIds:
          preparedTerrain.value.eligibleStartingRegionIds,
      });
      if (world.status !== "success") {
        throw new Error(`World create failed: ${world.code}`);
      }
      const terrain = terrainAdapter.create(
        world.value.spatial,
        preparedTerrain.value,
      );
      if (terrain.status !== "success") {
        throw new Error(`Terrain create failed: ${terrain.code}`);
      }

      const map = world.value.definition.mapDefinition;
      const planning = new Map<string, number>();
      for (const brushSize of [
        1, 3, 5,
      ] as const satisfies readonly TerraformBrushSize[]) {
        const measurement = timed(() =>
          requireValid(
            planTerraform({
              operation: "raise",
              targetCell: TARGET_CELL,
              brushSize,
              strength: "normal",
              mapDefinition: map,
              mapState: world.value.mapState,
              spatial: world.value.spatial,
              terrain: terrain.value.read,
            }),
          ),
        );
        planning.set(
          `raise${brushSize}x${brushSize}`,
          measurement.milliseconds,
        );
      }

      const flattenElevation = terrain.value.read.elevationAt(TARGET_CELL);
      if (flattenElevation.status !== "success") {
        throw new Error("Flatten baseline target elevation is unavailable.");
      }
      const flattenPlan = timed(() =>
        requireValid(
          planTerraform({
            operation: "flatten",
            targetCell: TARGET_CELL,
            brushSize: 5,
            strength: "normal",
            flattenTarget: flattenElevation.value,
            mapDefinition: map,
            mapState: world.value.mapState,
            spatial: world.value.spatial,
            terrain: terrain.value.read,
          }),
        ),
      );
      planning.set("flatten5x5", flattenPlan.milliseconds);

      const projectionResult = createTerrainThreeProjection({
        mapDefinition: map,
        world: world.value.spatial,
        terrain: terrain.value.read,
      });
      if (projectionResult.status !== "success") {
        throw new Error(`Terrain projection failed: ${projectionResult.code}`);
      }
      const projection = projectionResult.value;
      const debugResult = createTerrainThreeDebugOverlay({
        mapDefinition: map,
        world: world.value.spatial,
        terrain: terrain.value.read,
      });
      if (debugResult.status !== "success") {
        projection.dispose();
        throw new Error(`Terrain debug overlay failed: ${debugResult.code}`);
      }
      const debug = debugResult.value;

      const overlayConstruction = timed(() =>
        createTerraformThreeOverlay({
          mapDefinition: map,
          mapState: world.value.mapState,
          spatial: world.value.spatial,
          terrain: terrain.value.read,
        }),
      );
      const overlay = overlayConstruction.value;
      const initialGrid = timed(() => overlay.setActive(true));
      const facts = overlayFacts(overlay.root);
      expect(facts.lineObjectCount).toBeGreaterThan(0);
      expect(facts.materialCount).toBeGreaterThan(0);

      const rebuild1 = timed(() =>
        overlay.rebuild({ touchingLogicalChunks: [{ x: 4, z: 5 }] }),
      );
      const rebuild2 = timed(() =>
        overlay.rebuild({
          touchingLogicalChunks: [
            { x: 4, z: 5 },
            { x: 5, z: 5 },
          ],
        }),
      );
      const rebuild4 = timed(() =>
        overlay.rebuild({
          touchingLogicalChunks: [
            { x: 4, z: 5 },
            { x: 5, z: 5 },
            { x: 4, z: 6 },
            { x: 5, z: 6 },
          ],
        }),
      );

      const undo = createTerraformUndoHistory(terrain.value.read.revision());
      const runtime = createTerraformRuntime({
        terrain: terrain.value,
        projection,
        debugOverlay: debug,
        terraformPresentation: overlay,
        undo,
      });
      const commitPlan = requireValid(
        planTerraform({
          operation: "raise",
          targetCell: TARGET_CELL,
          brushSize: 1,
          strength: "normal",
          mapDefinition: map,
          mapState: world.value.mapState,
          spatial: world.value.spatial,
          terrain: terrain.value.read,
        }),
      );
      const commit = timed(() => runtime.commit(commitPlan));
      expect(commit.value.status).toBe("success");
      const undoMeasurement = timed(() => runtime.undo());
      expect(undoMeasurement.value.status).toBe("success");

      const report = Object.freeze({
        schema: "terraform-performance-baseline-v1",
        target: TARGET_CELL,
        logicalElevationMeters: logicalElevationToMeters(
          flattenElevation.value as LogicalElevation,
        ),
        timingsMilliseconds: {
          raise1x1Planning: planning.get("raise1x1"),
          raise3x3Planning: planning.get("raise3x3"),
          raise5x5Planning: planning.get("raise5x5"),
          flattenPlanning: planning.get("flatten5x5"),
          overlayConstruction: overlayConstruction.milliseconds,
          initialUnlockedGridConstruction: initialGrid.milliseconds,
          overlayRebuild1Chunk: rebuild1.milliseconds,
          overlayRebuild2Chunks: rebuild2.milliseconds,
          overlayRebuild4Chunks: rebuild4.milliseconds,
          commitWithLocalizedPresentation: commit.milliseconds,
          undoWithLocalizedPresentation: undoMeasurement.milliseconds,
        },
        resources: facts,
      });
      console.info(`TERRAFORM_PERFORMANCE_BASELINE ${JSON.stringify(report)}`);

      runtime.dispose();
      overlay.dispose();
      debug.dispose();
      projection.dispose();
    },
    120_000,
  );
});
