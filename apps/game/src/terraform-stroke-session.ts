import type { RoadSnapshot } from '@web-three-city/road-core';
import { createEmptyZoneSnapshot, type ZoneSnapshot } from '@web-three-city/zone-core';
import {
  planTerraformStroke,
  rasterizeTerraformCellLine,
  type TerrainSnapshot,
  type TerraformBrushSize,
  type TerraformOperation,
  type TerraformPlan,
  type TerraformStrokeInput,
} from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import {
  guardTerraformPlanWithOccupancy,
  type GameTerraformInvalidReason,
  type GuardedTerraformCandidate,
} from './terraform-occupancy-guard.js';

export type TerraformCurrentStamp =
  | { readonly kind: 'none' }
  | { readonly kind: 'accepted'; readonly anchor: CellCoord }
  | {
      readonly kind: 'rejected';
      readonly anchor: CellCoord;
      readonly reason: GameTerraformInvalidReason;
      readonly preview: GuardedTerraformCandidate;
    }
  | {
      readonly kind: 'no-change';
      readonly anchor: CellCoord;
      readonly preview: GuardedTerraformCandidate;
    };

export interface TerraformStrokeSessionState {
  readonly operation: TerraformOperation | null;
  readonly brushSize: TerraformBrushSize;
  readonly strokeActive: boolean;
  readonly flattenTargetLevel: number | null;
  readonly acceptedAnchors: readonly CellCoord[];
  readonly acceptedPlan: TerraformPlan | null;
  readonly currentStamp: TerraformCurrentStamp;
}

export type TerraformStrokeRelease =
  | { readonly kind: 'commit'; readonly plan: TerraformPlan }
  | { readonly kind: 'rejected'; readonly reason: GameTerraformInvalidReason }
  | { readonly kind: 'no-change' }
  | { readonly kind: 'ignored' };

export interface TerraformStrokeSession {
  begin(
    pointerId: number,
    operation: TerraformOperation,
    brushSize: TerraformBrushSize,
    anchor: CellCoord,
    flattenTargetLevel?: number,
  ): boolean;
  move(pointerId: number, anchor: CellCoord): void;
  end(pointerId: number, finalAnchor: CellCoord | null): TerraformStrokeRelease;
  cancel(pointerId: number): void;
  cancelAll(): void;
  getState(): TerraformStrokeSessionState;
}

export interface CreateTerraformStrokeSessionOptions {
  readonly config: WorldConfig;
  readonly getTerrainSnapshot: () => TerrainSnapshot;
  readonly getRoadSnapshot: () => RoadSnapshot;
  readonly getZoneSnapshot?: () => ZoneSnapshot;
  readonly onState: (state: TerraformStrokeSessionState) => void;
}

const NONE_STAMP: TerraformCurrentStamp = Object.freeze({ kind: 'none' });
const IGNORED_RELEASE: TerraformStrokeRelease = Object.freeze({ kind: 'ignored' });
const NO_CHANGE_RELEASE: TerraformStrokeRelease = Object.freeze({ kind: 'no-change' });

function cellKey(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function frozenCell(cell: CellCoord): CellCoord {
  return Object.freeze({ x: cell.x, z: cell.z });
}

function sameProjectedLattice(first: TerraformPlan, second: TerraformPlan): boolean {
  if (first.proposedHeightLevels.length !== second.proposedHeightLevels.length) return false;
  for (let index = 0; index < first.proposedHeightLevels.length; index += 1) {
    if (first.proposedHeightLevels[index] !== second.proposedHeightLevels[index]) return false;
  }
  return true;
}

export function createTerraformStrokeSession(
  options: CreateTerraformStrokeSessionOptions,
): TerraformStrokeSession {
  let pointerId: number | null = null;
  let operation: TerraformOperation | null = null;
  let brushSize: TerraformBrushSize = 1;
  let flattenTargetLevel: number | null = null;
  let capturedTerrain: TerrainSnapshot | null = null;
  let capturedRoads: RoadSnapshot | null = null;
  let capturedZones: ZoneSnapshot | null = null;
  let lastSampledAnchor: CellCoord | null = null;
  const visitedAnchors = new Set<string>();
  let acceptedAnchors: CellCoord[] = [];
  let acceptedPlan: TerraformPlan | null = null;
  let currentStamp: TerraformCurrentStamp = NONE_STAMP;

  const getState = (): TerraformStrokeSessionState =>
    Object.freeze({
      operation,
      brushSize,
      strokeActive: pointerId !== null,
      flattenTargetLevel,
      acceptedAnchors: Object.freeze(acceptedAnchors.map(frozenCell)),
      acceptedPlan,
      currentStamp,
    });

  const publish = (): void => options.onState(getState());

  const clear = (): void => {
    pointerId = null;
    operation = null;
    flattenTargetLevel = null;
    capturedTerrain = null;
    capturedRoads = null;
    capturedZones = null;
    lastSampledAnchor = null;
    visitedAnchors.clear();
    acceptedAnchors = [];
    acceptedPlan = null;
    currentStamp = NONE_STAMP;
    publish();
  };

  const inputFor = (anchors: readonly CellCoord[]): TerraformStrokeInput => {
    if (operation === null) throw new Error('terraform-stroke-session:no-operation');
    if (operation !== 'flatten') return { operation, brushSize, cells: anchors };
    return {
      operation,
      brushSize,
      cells: anchors,
      ...(flattenTargetLevel === null ? {} : { flattenTargetLevel }),
    };
  };

  const evaluateAnchor = (anchor: CellCoord): void => {
    if (
      capturedTerrain === null ||
      capturedRoads === null ||
      capturedZones === null ||
      operation === null
    )
      return;
    const key = cellKey(anchor);
    if (visitedAnchors.has(key)) return;
    visitedAnchors.add(key);

    const frozenAnchor = frozenCell(anchor);
    const tentativeAnchors = [...acceptedAnchors, frozenAnchor];
    const corePlan = planTerraformStroke(
      capturedTerrain,
      inputFor(tentativeAnchors),
      options.config,
    );
    const guarded = guardTerraformPlanWithOccupancy(corePlan, capturedRoads, capturedZones);

    if (guarded.valid) {
      if (acceptedPlan !== null && sameProjectedLattice(acceptedPlan, guarded.corePlan)) {
        currentStamp = Object.freeze({
          kind: 'no-change',
          anchor: frozenAnchor,
          preview: guarded,
        });
      } else {
        acceptedAnchors = tentativeAnchors;
        acceptedPlan = guarded.corePlan;
        currentStamp = Object.freeze({ kind: 'accepted', anchor: frozenAnchor });
      }
    } else if (guarded.invalidReason === 'terraform:no-change') {
      currentStamp = Object.freeze({
        kind: 'no-change',
        anchor: frozenAnchor,
        preview: guarded,
      });
    } else {
      currentStamp = Object.freeze({
        kind: 'rejected',
        anchor: frozenAnchor,
        reason: guarded.invalidReason ?? 'terraform:invalid-terrain',
        preview: guarded,
      });
    }
    publish();
  };

  const traverseTo = (anchor: CellCoord): void => {
    if (lastSampledAnchor === null) {
      evaluateAnchor(anchor);
    } else {
      for (const traversed of rasterizeTerraformCellLine(lastSampledAnchor, anchor)) {
        evaluateAnchor(traversed);
      }
    }
    lastSampledAnchor = frozenCell(anchor);
  };

  return {
    begin(
      nextPointerId: number,
      nextOperation: TerraformOperation,
      nextBrushSize: TerraformBrushSize,
      anchor: CellCoord,
      nextFlattenTargetLevel?: number,
    ): boolean {
      if (pointerId !== null) return false;
      pointerId = nextPointerId;
      operation = nextOperation;
      brushSize = nextBrushSize;
      flattenTargetLevel = nextOperation === 'flatten' ? (nextFlattenTargetLevel ?? null) : null;
      capturedTerrain = options.getTerrainSnapshot();
      capturedRoads = options.getRoadSnapshot();
      capturedZones = options.getZoneSnapshot?.() ?? createEmptyZoneSnapshot(options.config);
      lastSampledAnchor = null;
      visitedAnchors.clear();
      acceptedAnchors = [];
      acceptedPlan = null;
      currentStamp = NONE_STAMP;
      traverseTo(anchor);
      return true;
    },
    move(activePointerId: number, anchor: CellCoord): void {
      if (pointerId !== activePointerId) return;
      traverseTo(anchor);
    },
    end(activePointerId: number, finalAnchor: CellCoord | null): TerraformStrokeRelease {
      if (pointerId !== activePointerId) return IGNORED_RELEASE;
      if (finalAnchor !== null) traverseTo(finalAnchor);

      let release: TerraformStrokeRelease;
      if (acceptedPlan !== null) {
        release = Object.freeze({ kind: 'commit', plan: acceptedPlan });
      } else if (currentStamp.kind === 'no-change') {
        release = NO_CHANGE_RELEASE;
      } else if (currentStamp.kind === 'rejected') {
        release = Object.freeze({ kind: 'rejected', reason: currentStamp.reason });
      } else {
        release = IGNORED_RELEASE;
      }
      clear();
      return release;
    },
    cancel(activePointerId: number): void {
      if (pointerId === activePointerId) clear();
    },
    cancelAll(): void {
      if (pointerId !== null || operation !== null || acceptedPlan !== null) clear();
    },
    getState,
  };
}
