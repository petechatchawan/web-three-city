import type { LiveCitySession } from "@web-three-city/orchestration-city-session";
import {
  logicalElevationToMeters,
  type LogicalElevation,
} from "@web-three-city/terrain";
import type {
  TerrainThreeDebugOverlay,
  TerrainThreeProjection,
} from "@web-three-city/terrain/composition";
import {
  selectFlattenReference,
  type TerraformBrushSize,
  type TerraformOperation,
  type TerraformPreview,
  type TerraformStrength,
} from "@web-three-city/terraform";
import {
  createTerraformThreeOverlay,
  createTerraformUndoHistory,
  planTerraform,
  type TerraformThreeOverlay,
} from "@web-three-city/terraform/composition";
import type { TerrainPointerPickResult } from "../../presentation/interaction/create-terrain-pointer-picker";
import { CITY_INPUT_DEFAULT_CONFIG } from "../../presentation/input/input-config";
import { createTerraformToolView } from "../../ui/tools/terraform/create-terraform-tool-view";
import type { TerraformToolViewState } from "../../ui/tools/terraform/terraform-tool-view-state";
import { createTerraformPointerSession } from "../terraform/terraform-pointer-session";
import { createTerraformRuntime } from "../terraform/create-terraform-runtime";
import type { GameToolRuntime } from "./create-game-tool-coordinator";

export interface TerraformGameTool extends GameToolRuntime {
  readonly overlay: TerraformThreeOverlay;
  state(): TerraformToolViewState;
}

function previewValidity(
  preview: TerraformPreview | undefined,
): TerraformToolViewState["validity"] {
  if (preview === undefined) return "idle";
  return preview.status === "valid" ? "valid" : "invalid";
}

export function createTerraformGameTool(input: {
  readonly session: Pick<LiveCitySession, "world" | "terrain">;
  readonly projection: TerrainThreeProjection;
  readonly debugOverlay: TerrainThreeDebugOverlay;
  readonly pickClientPoint: (
    clientX: number,
    clientY: number,
  ) => TerrainPointerPickResult;
  readonly onPick: (pick: TerrainPointerPickResult) => void;
  readonly requestRender: () => void;
  readonly onStateChange: (
    state: TerraformToolViewState,
    active: boolean,
  ) => void;
}): TerraformGameTool {
  const map = input.session.world.definition.mapDefinition;
  const overlay = createTerraformThreeOverlay({
    mapDefinition: map,
    spatial: input.session.world.spatial,
    mapState: input.session.world.mapState,
    terrain: input.session.terrain.read,
  });
  overlay.setActive(false);
  overlay.root.userData.testid = "terraform-overlay-root";

  const undo = createTerraformUndoHistory(
    input.session.terrain.read.revision(),
  );
  const runtime = createTerraformRuntime({
    terrain: input.session.terrain,
    projection: input.projection,
    debugOverlay: input.debugOverlay,
    terraformPresentation: overlay,
    undo,
  });

  let active = false;
  let operation: TerraformOperation = "raise";
  let brushSize: TerraformBrushSize = 1;
  let strength: TerraformStrength = "normal";
  let flattenTarget: LogicalElevation | undefined;
  let lastPreviewPoint: readonly [number, number] | undefined;
  let validity: TerraformToolViewState["validity"] = "idle";
  let message: string | undefined;
  let disposed = false;

  const state = (): TerraformToolViewState =>
    Object.freeze({
      operation,
      brushSize,
      strength,
      ...(flattenTarget === undefined
        ? {}
        : { flattenTargetMeters: logicalElevationToMeters(flattenTarget) }),
      undoDepth: undo.depth(),
      validity,
      ...(message === undefined ? {} : { message }),
    });

  const render = (): void => {
    const next = state();
    view.render(next);
    input.onStateChange(next, active);
  };

  const clearPreview = (): void => {
    lastPreviewPoint = undefined;
    overlay.setPreview(undefined);
    validity = "idle";
    render();
    input.requestRender();
  };

  const planFromPick = (
    pick: Extract<TerrainPointerPickResult, { status: "hit" }>,
  ): TerraformPreview =>
    planTerraform({
      operation,
      targetCell: pick.value.cell,
      brushSize,
      strength,
      ...(flattenTarget === undefined ? {} : { flattenTarget }),
      mapDefinition: map,
      mapState: input.session.world.mapState,
      spatial: input.session.world.spatial,
      terrain: input.session.terrain.read,
    });

  const previewClientPoint = (clientX: number, clientY: number): void => {
    if (!active || disposed) return;
    lastPreviewPoint = Object.freeze([clientX, clientY]);
    const pick = input.pickClientPoint(clientX, clientY);
    input.onPick(pick);
    if (pick.status !== "hit") {
      overlay.setPreview(undefined);
      validity = "idle";
      message = "No editable Terrain target";
      render();
      input.requestRender();
      return;
    }
    const preview = planFromPick(pick);
    overlay.setPreview(preview);
    validity = previewValidity(preview);
    message = preview.status === "valid" ? "Ready" : preview.reason;
    render();
    input.requestRender();
  };

  const refreshPreview = (): void => {
    const point = lastPreviewPoint;
    if (active && point !== undefined) previewClientPoint(point[0], point[1]);
    else clearPreview();
  };

  const commitClientPoint = (clientX: number, clientY: number): void => {
    const pick = input.pickClientPoint(clientX, clientY);
    input.onPick(pick);
    if (!active || disposed || pick.status !== "hit") return;

    if (operation === "flatten" && flattenTarget === undefined) {
      const reference = selectFlattenReference({
        pick: pick.value,
        mapDefinition: map,
        mapState: input.session.world.mapState,
        spatial: input.session.world.spatial,
        terrain: input.session.terrain.read,
      });
      if (reference.status === "success") {
        flattenTarget = reference.value;
        message = `Flatten level ${logicalElevationToMeters(reference.value).toFixed(2)}m selected`;
        render();
        previewClientPoint(clientX, clientY);
      } else {
        validity = "invalid";
        message = reference.reason;
        render();
      }
      return;
    }

    const preview = planFromPick(pick);
    if (preview.status !== "valid") {
      overlay.setPreview(preview);
      validity = "invalid";
      message = preview.reason;
      render();
      input.requestRender();
      return;
    }

    const result = runtime.commit(preview.plan);
    const refreshed = planFromPick(pick);
    overlay.setPreview(refreshed);
    validity = previewValidity(refreshed);
    message =
      result.status === "success"
        ? "Terrain updated"
        : result.status === "noop"
          ? "No Terrain change"
          : result.reason;
    render();
    input.requestRender();
  };

  const view = createTerraformToolView({
    onOperation: (next) => {
      operation = next;
      if (next !== "flatten") flattenTarget = undefined;
      refreshPreview();
    },
    onBrushSize: (next) => {
      brushSize = next;
      refreshPreview();
    },
    onStrength: (next) => {
      strength = next;
      refreshPreview();
    },
    onRepickLevel: () => {
      flattenTarget = undefined;
      message = "Pick a Flatten reference level";
      refreshPreview();
      message = "Pick a Flatten reference level";
      render();
    },
    onUndo: () => {
      if (!active || disposed) return;
      const result = runtime.undo();
      refreshPreview();
      message =
        result.status === "success" ? "Undo applied" : "Undo unavailable";
      render();
      input.requestRender();
    },
  });

  const pointerSession = createTerraformPointerSession({
    tapThresholdPixels: CITY_INPUT_DEFAULT_CONFIG.tapThresholdPixels,
    onPreviewClientPoint: previewClientPoint,
    onClearPreview: clearPreview,
  });

  render();

  const tool: TerraformGameTool = {
    descriptor: {
      id: "terrain",
      label: "Terrain",
      icon: "terrain",
      shortcut: "T",
      order: 10,
      category: { id: "environment", label: "Environment", order: 20 },
    },
    availability: () => ({ status: "available" }),
    view,
    overlay,
    pointerSink: pointerSession,
    onSemanticTap: commitClientPoint,
    state,
    activate(): void {
      if (disposed || active) return;
      active = true;
      overlay.setActive(true);
      validity = "idle";
      message = "Terraform active";
      render();
      input.requestRender();
    },
    deactivate(): void {
      if (disposed || !active) return;
      active = false;
      flattenTarget = undefined;
      lastPreviewPoint = undefined;
      overlay.setPreview(undefined);
      overlay.setActive(false);
      validity = "idle";
      message = "Terraform closed";
      render();
      input.requestRender();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      pointerSession.dispose();
      runtime.dispose();
      overlay.setPreview(undefined);
      overlay.dispose();
      view.dispose();
      lastPreviewPoint = undefined;
      flattenTarget = undefined;
    },
  };
  return Object.freeze(tool);
}
