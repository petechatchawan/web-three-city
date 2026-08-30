import { prepareProductionWorldDefinition } from "@web-three-city/world/composition";
import { Mesh, type Group } from "three";
import { describe, expect, it } from "vitest";
import type { LogicalElevation } from "../src/index";
import {
  createTerrainSystem,
  createTerrainThreeProjection,
  prepareProductionTerrain,
  restoreTerrainSystem,
  type TerrainSystem,
} from "../src/composition";

const GOLDEN_SEED = "0x5EED5EED5EED5EED";

function environmentFlag(name: string): boolean {
  const processValue = Reflect.get(globalThis, "process");
  if (typeof processValue !== "object" || processValue === null) return false;
  const environment = Reflect.get(processValue, "env");
  if (typeof environment !== "object" || environment === null) return false;
  return Reflect.get(environment, name) === "1";
}

const BASELINE_ENABLED = environmentFlag("TERRAIN_PERFORMANCE_BASELINE");

interface Timing<T> {
  readonly value: T;
  readonly milliseconds: number;
}

function timed<T>(operation: () => T): Timing<T> {
  const started = performance.now();
  const value = operation();
  return Object.freeze({
    value,
    milliseconds: performance.now() - started,
  });
}

function memoryUsageBytes(): number | undefined {
  const processValue = Reflect.get(globalThis, "process");
  if (typeof processValue !== "object" || processValue === null) return undefined;
  const memoryUsage = Reflect.get(processValue, "memoryUsage");
  if (typeof memoryUsage !== "function") return undefined;
  const result = Reflect.apply(memoryUsage, processValue, []) as unknown;
  if (typeof result !== "object" || result === null) return undefined;
  const heapUsed = Reflect.get(result, "heapUsed");
  return typeof heapUsed === "number" ? heapUsed : undefined;
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

function projectionFacts(root: Group): {
  readonly geometryCount: number;
  readonly materialCount: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly geometryBufferBytes: number;
} {
  let geometryCount = 0;
  let vertexCount = 0;
  let indexCount = 0;
  let geometryBufferBytes = 0;
  const materials = new Set<unknown>();

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometryCount += 1;
    const geometry = object.geometry;
    const position = geometry.getAttribute("position");
    vertexCount += position.count;

    for (const attribute of Object.values(geometry.attributes)) {
      const storage = attribute as unknown as {
        readonly array?: unknown;
        readonly data?: { readonly array?: unknown };
      };
      geometryBufferBytes += byteLength(storage.array ?? storage.data?.array);
    }

    const index = geometry.getIndex();
    if (index !== null) {
      indexCount += index.count;
      geometryBufferBytes += byteLength(index.array);
    }

    const meshMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of meshMaterials) materials.add(material);
  });

  return Object.freeze({
    geometryCount,
    materialCount: materials.size,
    vertexCount,
    triangleCount: indexCount / 3,
    geometryBufferBytes,
  });
}

function changeOneVertex(input: {
  readonly terrain: TerrainSystem;
  readonly x: number;
  readonly z: number;
}) {
  const current = input.terrain.read.elevationAt({ x: input.x, z: input.z });
  if (current.status !== "success") {
    throw new Error(`Unable to read baseline vertex ${input.x},${input.z}.`);
  }

  const mutation = input.terrain.commands.applyEdits({
    edits: [
      {
        vertex: { x: input.x, z: input.z },
        elevation: (current.value + 1) as LogicalElevation,
      },
    ],
  });
  if (mutation.status !== "success") {
    throw new Error(`Unable to mutate baseline vertex ${input.x},${input.z}.`);
  }
  return mutation.value.changeSet;
}

function requireProjection(result: ReturnType<typeof createTerrainThreeProjection>) {
  if (result.status !== "success") {
    throw new Error(`Terrain projection failed with code ${result.code}.`);
  }
  return result.value;
}

function measureRebuild(input: {
  readonly terrain: TerrainSystem;
  readonly projection: ReturnType<typeof requireProjection>;
  readonly x: number;
  readonly z: number;
  readonly expectedReplacedSectors: number;
}) {
  const before = new Map(
    input.projection.root.children.map((child) => [child.name, child]),
  );
  const mutation = timed(() =>
    changeOneVertex({ terrain: input.terrain, x: input.x, z: input.z }),
  );
  const rebuild = timed(() => input.projection.rebuild(mutation.value));
  const replacedSectors = input.projection.root.children.filter(
    (child) => before.get(child.name) !== child,
  ).length;

  expect(replacedSectors).toBe(input.expectedReplacedSectors);
  return Object.freeze({
    mutationMilliseconds: mutation.milliseconds,
    rebuildMilliseconds: rebuild.milliseconds,
    replacedSectors,
  });
}

describe("Terrain production performance baseline", () => {
  it.skipIf(!BASELINE_ENABLED)(
    "records production generation, projection, rebuild, snapshot, restore and memory facts",
    () => {
      const worldTiming = timed(() => prepareProductionWorldDefinition());
      if (worldTiming.value.status !== "success") {
        throw new Error(
          `Production World preparation failed with code ${worldTiming.value.code}.`,
        );
      }
      const world = worldTiming.value.value;

      const generationTiming = timed(() =>
        prepareProductionTerrain({ world, seed64: GOLDEN_SEED }),
      );
      if (generationTiming.value.status !== "success") {
        throw new Error(
          `Production Terrain generation failed with code ${generationTiming.value.code}.`,
        );
      }
      const generated = generationTiming.value.value;

      const creationHeapBefore = memoryUsageBytes();
      const systemTiming = timed(() =>
        createTerrainSystem({
          world: world.spatial,
          mapDefinitionId: world.mapDefinition.mapDefinitionId,
          generationProfileId: world.mapDefinition.terrainGenerationProfileId,
          generationProfileVersion:
            world.mapDefinition.terrainGenerationProfileVersion,
          selectedSeed64: generated.selectedSeed64,
          fingerprint: generated.fingerprint,
          source: generated.field,
        }),
      );
      if (systemTiming.value.status !== "success") {
        throw new Error(
          `Terrain system creation failed with reason ${systemTiming.value.reason}.`,
        );
      }
      const terrain = systemTiming.value.value;

      const projectionHeapBefore = memoryUsageBytes();
      const projectionTiming = timed(() =>
        requireProjection(
          createTerrainThreeProjection({
            mapDefinition: world.mapDefinition,
            world: world.spatial,
            terrain: terrain.read,
          }),
        ),
      );
      const projection = projectionTiming.value;
      const projectionHeapAfter = memoryUsageBytes();

      const oneSector = measureRebuild({
        terrain,
        projection,
        x: 130,
        z: 130,
        expectedReplacedSectors: 1,
      });
      const twoSectors = measureRebuild({
        terrain,
        projection,
        x: 192,
        z: 130,
        expectedReplacedSectors: 2,
      });
      const fourSectors = measureRebuild({
        terrain,
        projection,
        x: 320,
        z: 320,
        expectedReplacedSectors: 4,
      });

      const snapshotTiming = timed(() => terrain.captureSnapshot());
      const encodeTiming = timed(() => JSON.stringify(snapshotTiming.value));
      const encodedBytes = new TextEncoder().encode(
        encodeTiming.value,
      ).byteLength;
      const restoreTiming = timed(() =>
        restoreTerrainSystem({
          world: world.spatial,
          mapDefinitionId: world.mapDefinition.mapDefinitionId,
          snapshot: snapshotTiming.value,
        }),
      );
      if (restoreTiming.value.status !== "success") {
        throw new Error(
          `Terrain restore failed with reason ${restoreTiming.value.reason}.`,
        );
      }
      expect(restoreTiming.value.value.captureSnapshot()).toEqual(
        snapshotTiming.value,
      );

      const facts = projectionFacts(projection.root);
      expect(facts).toMatchObject({
        geometryCount: 64,
        materialCount: 1,
        triangleCount: 524_288,
      });
      expect(facts.vertexCount).toBe(270_400);
      expect(snapshotTiming.value.revision).toBe(3);

      const creationHeapAfter = memoryUsageBytes();
      const report = Object.freeze({
        schema: "terrain-performance-baseline-v1",
        world: {
          widthCells: world.mapDefinition.widthCells,
          heightCells: world.mapDefinition.heightCells,
          canonicalVertexCount:
            (world.mapDefinition.widthCells + 1) *
            (world.mapDefinition.heightCells + 1),
          renderSectors: facts.geometryCount,
          triangles: facts.triangleCount,
        },
        timingsMilliseconds: {
          worldPreparation: worldTiming.milliseconds,
          generation: generationTiming.milliseconds,
          systemCreation: systemTiming.milliseconds,
          initialProjection64Sectors: projectionTiming.milliseconds,
          rebuild1Sector: oneSector.rebuildMilliseconds,
          rebuild2Sectors: twoSectors.rebuildMilliseconds,
          rebuild4Sectors: fourSectors.rebuildMilliseconds,
          snapshotCapture: snapshotTiming.milliseconds,
          snapshotEncode: encodeTiming.milliseconds,
          restore: restoreTiming.milliseconds,
        },
        mutationTimingsMilliseconds: {
          oneSectorCase: oneSector.mutationMilliseconds,
          twoSectorCase: twoSectors.mutationMilliseconds,
          fourSectorCase: fourSectors.mutationMilliseconds,
        },
        storage: {
          snapshotEncodedBytes: encodedBytes,
          geometryBufferBytes: facts.geometryBufferBytes,
          geometryCount: facts.geometryCount,
          materialCount: facts.materialCount,
          projectedVertexCount: facts.vertexCount,
        },
        memory: {
          heapUsedBeforeSystem: creationHeapBefore,
          heapUsedBeforeProjection: projectionHeapBefore,
          heapUsedAfterProjection: projectionHeapAfter,
          heapUsedAfterMeasurements: creationHeapAfter,
          projectionHeapDelta:
            projectionHeapBefore === undefined || projectionHeapAfter === undefined
              ? undefined
              : projectionHeapAfter - projectionHeapBefore,
        },
      });

      console.info(
        `TERRAIN_PERFORMANCE_BASELINE ${JSON.stringify(report)}`,
      );
      projection.dispose();
    },
    120_000,
  );
});
