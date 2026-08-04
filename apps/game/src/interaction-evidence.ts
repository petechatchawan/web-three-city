import {
  CAMERA_DEFAULTS,
  type CameraState,
  type OrthographicCameraRig,
} from '@web-three-city/camera-input';
import type { BuildingInvalidReason } from '@web-three-city/building-core';
import type { TerraformBrushSize, WorldToolMode } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import type { ZoneCounts, ZoneInvalidReason } from '@web-three-city/zone-core';
import * as THREE from 'three';
import type { GameInput, GameRenderViewport } from './game-input.js';
import type { GameTerraformInvalidReason } from './terraform-occupancy-guard.js';
import type { GameZoneInvalidReason } from './zone-building-guard.js';
import type { TerraformCurrentStamp } from './terraform-stroke-session.js';

export interface WaterInteractionEvidence {
  readonly sourceTerrainRevision: number;
  readonly seaTriangleCount: number;
  readonly enclosedWetTriangleCount: number;
  readonly shorelineSegmentCount: number;
  readonly surfaceTriangleCount: number;
  readonly shorelineTriangleCount: number;
  readonly wallSegmentCount: number;
  readonly estimatedGeometryBytes: number;
  readonly derivationDurationMs: number;
  readonly presentationDurationMs: number;
  readonly waterRootCount: number;
}

export interface TerraformInteractionEvidence {
  readonly mode: WorldToolMode;
  readonly brushSize: TerraformBrushSize;
  readonly strokeActive: boolean;
  readonly previewValid: boolean | null;
  readonly previewInvalidReason: GameTerraformInvalidReason | null;
  readonly previewCellCount: number;
  readonly acceptedStampCount: number;
  readonly supportCellCount: number;
  readonly currentStampKind: TerraformCurrentStamp['kind'];
  readonly flattenTargetLevel: number | null;
  readonly committedTerrainRevision: number;
  readonly waterSourceTerrainRevision: number;
  readonly undoAvailable: boolean;
  readonly commitCount: number;
  readonly undoCount: number;
  readonly waterRebuildCount: number;
  readonly previewRootCount: number;
  readonly previewCoreCount: number;
  readonly previewSupportCount: number;
  readonly previewRejectedCount: number;
  readonly previewNoChangeCount: number;
  readonly previewWaterCount: number;
  readonly previewRejectedMarkerCount: number;
}

export interface RoadPreviewBoundsEvidence {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

export interface RoadInteractionEvidence {
  readonly mode: 'road-build' | 'road-bulldoze' | null;
  readonly strokeActive: boolean;
  readonly previewValid: boolean | null;
  readonly previewCellCount: number;
  readonly committedRoadRevision: number;
  readonly occupiedCellCount: number;
  readonly commitCount: number;
  readonly bulldozeCount: number;
  readonly undoCount: number;
  readonly lastDirtyChunkCount: number;
  readonly chunkRebuildCount: number;
  readonly terrainRevision: number;
  readonly waterSourceTerrainRevision: number;
  readonly undoKind: 'terraform' | 'road' | 'zone' | 'building' | null;
  readonly estimatedGeometryBytes: number;
  readonly committedRootCount: number;
  readonly previewRootCount: number;
  readonly invalidMarkerCount: number;
  readonly bulldozeMarkerCount: number;
  readonly previewBounds: RoadPreviewBoundsEvidence | null;
}

export interface ZoneInteractionEvidence {
  readonly mode: 'zone-residential' | 'zone-commercial' | 'zone-industrial' | 'zone-remove' | null;
  readonly strokeActive: boolean;
  readonly previewValid: boolean | null;
  readonly previewInvalidReason: ZoneInvalidReason | null;
  readonly previewCellCount: number;
  readonly committedZoneRevision: number;
  readonly counts: ZoneCounts;
  readonly commitCount: number;
  readonly removeCount: number;
  readonly undoCount: number;
  readonly lastDirtyChunkCount: number;
  readonly chunkRebuildCount: number;
  readonly terrainRevision: number;
  readonly waterSourceTerrainRevision: number;
  readonly roadRevision: number;
  readonly undoKind: 'terraform' | 'road' | 'zone' | 'building' | null;
  readonly invalidReason: GameZoneInvalidReason | null;
  readonly committedRootCount: number;
  readonly previewRootCount: number;
  readonly invalidMarkerCount: number;
  readonly previewBounds: RoadPreviewBoundsEvidence | null;
}

export interface BuildingInteractionEvidence {
  readonly mode: 'building-develop' | 'building-bulldoze' | null;
  readonly strokeActive: boolean;
  readonly cell: CellCoord | null;
  readonly committedBuildingRevision: number;
  readonly count: number;
  readonly occupiedCellCount: number;
  readonly definitionIds: readonly string[];
  readonly commitCount: number;
  readonly bulldozeCount: number;
  readonly undoCount: number;
  readonly terrainRevision: number;
  readonly roadRevision: number;
  readonly zoneRevision: number;
  readonly undoKind: 'terraform' | 'road' | 'zone' | 'building' | null;
  readonly invalidReason: BuildingInvalidReason | null;
  readonly committedRootCount: number;
}

export interface InteractionEvidence {
  readonly camera: CameraState;
  readonly selectedCell: CellCoord | null;
  readonly gridVisible: boolean;
  readonly activePointerCount: number;
  readonly allWorldCornersInsideUsableViewport: boolean;
  readonly framingMarginRatio: number;
  readonly water: WaterInteractionEvidence;
  readonly terraform: TerraformInteractionEvidence;
  readonly road: RoadInteractionEvidence;
  readonly zone: ZoneInteractionEvidence;
  readonly building: BuildingInteractionEvidence;
  readonly sceneRootCounts: {
    readonly terrain: number;
    readonly water: number;
    readonly grid: number;
    readonly selection: number;
    readonly preview: number;
    readonly roadCommitted: number;
    readonly roadPreview: number;
    readonly zoneCommitted: number;
    readonly zonePreview: number;
    readonly buildingCommitted: number;
  };
}

export interface InteractionEvidenceSource {
  readonly camera: THREE.OrthographicCamera;
  readonly cameraRig: OrthographicCameraRig;
  readonly config: WorldConfig;
  readonly scene: THREE.Scene;
  readonly input: GameInput;
  getViewport(): GameRenderViewport;
  getSelectedCell(): CellCoord | null;
  getGridVisible(): boolean;
  getWaterEvidence(): Omit<WaterInteractionEvidence, 'waterRootCount'>;
  getTerraformEvidence(): Omit<
    TerraformInteractionEvidence,
    | 'previewRootCount'
    | 'previewCoreCount'
    | 'previewSupportCount'
    | 'previewRejectedCount'
    | 'previewNoChangeCount'
    | 'previewWaterCount'
    | 'previewRejectedMarkerCount'
  >;
  getBuildingEvidence(): Omit<BuildingInteractionEvidence, 'committedRootCount'>;
  getZoneEvidence(): Omit<
    ZoneInteractionEvidence,
    'committedRootCount' | 'previewRootCount' | 'invalidMarkerCount' | 'previewBounds'
  >;
  getRoadEvidence(): Omit<
    RoadInteractionEvidence,
    | 'committedRootCount'
    | 'previewRootCount'
    | 'invalidMarkerCount'
    | 'bulldozeMarkerCount'
    | 'previewBounds'
  >;
}

declare global {
  interface Window {
    __WEB_THREE_CITY_INTERACTION__?: InteractionEvidence;
  }
}

function worldCorners(config: WorldConfig): readonly THREE.Vector3[] {
  const halfWidth = (config.mapWidth * config.cellSize) / 2;
  const halfHeight = (config.mapHeight * config.cellSize) / 2;
  const maximumY = config.maxHeightLevel * config.heightStep;
  const corners: THREE.Vector3[] = [];
  for (const y of [config.dioramaBaseY, maximumY]) {
    for (const x of [-halfWidth, halfWidth]) {
      for (const z of [-halfHeight, halfHeight]) corners.push(new THREE.Vector3(x, y, z));
    }
  }
  return corners;
}

function allCornersInside(
  camera: THREE.OrthographicCamera,
  config: WorldConfig,
  viewport: GameRenderViewport,
): boolean {
  camera.updateMatrixWorld(true);
  return worldCorners(config).every((corner) => {
    const projected = corner.project(camera);
    const x = viewport.left + ((projected.x + 1) / 2) * viewport.width;
    const y = viewport.top + (1 - (projected.y + 1) / 2) * viewport.height;
    return (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= viewport.left - 1e-4 &&
      x <= viewport.left + viewport.width + 1e-4 &&
      y >= viewport.top - 1e-4 &&
      y <= viewport.top + viewport.height + 1e-4
    );
  });
}

function countRoots(scene: THREE.Scene, name: string): number {
  return scene.children.filter((child) => child.name === name).length;
}

function countNamedObjects(scene: THREE.Scene, name: string): number {
  let count = 0;
  scene.traverse((object) => {
    if (object.name === name) count += 1;
  });
  return count;
}

function countRoadPreviewRoots(scene: THREE.Scene): number {
  return (
    countRoots(scene, 'road-preview-root-valid') + countRoots(scene, 'road-preview-root-invalid')
  );
}

function countZonePreviewRoots(scene: THREE.Scene): number {
  return (
    countRoots(scene, 'zone-preview-root-valid') + countRoots(scene, 'zone-preview-root-invalid')
  );
}

function namedPreviewBounds(
  scene: THREE.Scene,
  rootNames: readonly string[],
): RoadPreviewBoundsEvidence | null {
  const bounds = new THREE.Box3();
  let hasGeometry = false;
  for (const root of scene.children) {
    if (!rootNames.includes(root.name)) continue;
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return;
      const position = object.geometry.getAttribute('position');
      if (position === undefined || position.count === 0) return;
      object.geometry.computeBoundingBox();
      const geometryBounds = object.geometry.boundingBox;
      if (geometryBounds === null) return;
      bounds.union(geometryBounds.clone().applyMatrix4(object.matrixWorld));
      hasGeometry = true;
    });
  }
  if (!hasGeometry) return null;
  return Object.freeze({
    minX: bounds.min.x,
    minY: bounds.min.y,
    minZ: bounds.min.z,
    maxX: bounds.max.x,
    maxY: bounds.max.y,
    maxZ: bounds.max.z,
  });
}

export function publishInteractionEvidence(source: InteractionEvidenceSource): void {
  const evidence: InteractionEvidence = {
    get camera(): CameraState {
      return source.cameraRig.state;
    },
    get selectedCell(): CellCoord | null {
      const cell = source.getSelectedCell();
      return cell === null ? null : { ...cell };
    },
    get gridVisible(): boolean {
      return source.getGridVisible();
    },
    get activePointerCount(): number {
      return source.input.activePointerCount;
    },
    get allWorldCornersInsideUsableViewport(): boolean {
      return allCornersInside(source.camera, source.config, source.getViewport());
    },
    framingMarginRatio: CAMERA_DEFAULTS.framingMarginRatio,
    get water(): WaterInteractionEvidence {
      return {
        ...source.getWaterEvidence(),
        waterRootCount: countRoots(source.scene, 'water-presentation-root'),
      };
    },
    get terraform(): TerraformInteractionEvidence {
      const state = source.getTerraformEvidence();
      return {
        ...state,
        previewValid: state.currentStampKind === 'no-change' ? false : state.previewValid,
        previewCellCount: Math.max(0, state.previewCellCount - state.supportCellCount),
        previewRootCount: countRoots(source.scene, 'terraform-preview-root'),
        previewCoreCount: countNamedObjects(source.scene, 'terraform-preview-core'),
        previewSupportCount: countNamedObjects(source.scene, 'terraform-preview-support'),
        previewRejectedCount: countNamedObjects(source.scene, 'terraform-preview-rejected'),
        previewNoChangeCount: countNamedObjects(source.scene, 'terraform-preview-no-change'),
        previewWaterCount: countNamedObjects(source.scene, 'terraform-preview-water'),
        previewRejectedMarkerCount: countNamedObjects(
          source.scene,
          'terraform-preview-rejected-marker',
        ),
      };
    },
    get road(): RoadInteractionEvidence {
      return {
        ...source.getRoadEvidence(),
        committedRootCount: countRoots(source.scene, 'road-committed-root'),
        previewRootCount: countRoadPreviewRoots(source.scene),
        invalidMarkerCount: countNamedObjects(source.scene, 'road-preview-invalid-marker'),
        bulldozeMarkerCount: countNamedObjects(source.scene, 'road-preview-bulldoze-marker'),
        previewBounds: namedPreviewBounds(source.scene, [
          'road-preview-root-valid',
          'road-preview-root-invalid',
        ]),
      };
    },
    get building(): BuildingInteractionEvidence {
      return {
        ...source.getBuildingEvidence(),
        committedRootCount: countRoots(source.scene, 'building-committed-root'),
      };
    },
    get zone(): ZoneInteractionEvidence {
      return {
        ...source.getZoneEvidence(),
        committedRootCount: countRoots(source.scene, 'zone-committed-root'),
        previewRootCount: countZonePreviewRoots(source.scene),
        invalidMarkerCount: countNamedObjects(source.scene, 'zone-preview-invalid-marker'),
        previewBounds: namedPreviewBounds(source.scene, [
          'zone-preview-root-valid',
          'zone-preview-root-invalid',
        ]),
      };
    },
    get sceneRootCounts() {
      return {
        terrain: countRoots(source.scene, 'terrain-presentation-root'),
        water: countRoots(source.scene, 'water-presentation-root'),
        grid: countRoots(source.scene, 'terrain-grid-presentation-root'),
        selection: countRoots(source.scene, 'selected-cell-presentation-root'),
        preview: countRoots(source.scene, 'terraform-preview-root'),
        roadCommitted: countRoots(source.scene, 'road-committed-root'),
        roadPreview: countRoadPreviewRoots(source.scene),
        zoneCommitted: countRoots(source.scene, 'zone-committed-root'),
        zonePreview: countZonePreviewRoots(source.scene),
        buildingCommitted: countRoots(source.scene, 'building-committed-root'),
      };
    },
  };
  window.__WEB_THREE_CITY_INTERACTION__ = evidence;
}
