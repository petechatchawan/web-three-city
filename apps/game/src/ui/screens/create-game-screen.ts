import type { TerrainDebugLayer } from "@web-three-city/terrain/composition";
import { createButton } from "../primitives/button";
import { createSwitch } from "../primitives/switch";
import type { ScreenHandle } from "./screen-types";

const DEBUG_OPTIONS: readonly {
  readonly layer: TerrainDebugLayer;
  readonly label: string;
  readonly description: string;
}[] = Object.freeze([
  {
    layer: "cellGrid",
    label: "Gameplay grid",
    description: "Gameplay Cell boundaries conforming to Terrain.",
  },
  {
    layer: "renderSectors",
    label: "Render sectors",
    description: "Presentation-sector boundaries used for localized rebuilds.",
  },
  {
    layer: "vertices",
    label: "Terrain vertices",
    description: "Canonical Terrain Vertex positions sampled by the surface.",
  },
  {
    layer: "triangles",
    label: "Triangle topology",
    description: "Fixed semantic triangle topology for every Terrain Cell.",
  },
  {
    layer: "normals",
    label: "Normals",
    description: "Sampled global presentation normals for seam inspection.",
  },
  {
    layer: "elevation",
    label: "Elevation",
    description: "Deterministic colorized elevation diagnostic surface.",
  },
]);

export interface GameScreenHandle extends ScreenHandle {
  readonly viewport: HTMLElement;
  setSaving(saving: boolean): void;
  setSaveStatus(message?: string): void;
  setPickStatus(message: string): void;
  setDebugLayers(layers: readonly TerrainDebugLayer[]): void;
}

export function createGameScreen(input: {
  readonly cityName: string;
  readonly seed64: string;
  readonly revision: number;
  readonly onSave: () => void;
  readonly onExit: () => void;
  readonly onDebugChange: (layer: TerrainDebugLayer, checked: boolean) => void;
  readonly onClearDebug: () => void;
}): GameScreenHandle {
  const element = document.createElement("section");
  element.className = "game-screen";
  element.dataset.testid = "game-screen";
  const viewport = document.createElement("div");
  viewport.className = "game-screen__viewport";
  viewport.dataset.testid = "game-viewport";

  const hud = document.createElement("header");
  hud.className = "game-hud";
  const identity = document.createElement("div");
  identity.className = "game-hud__identity";
  const name = document.createElement("h1");
  name.className = "game-hud__title";
  name.textContent = input.cityName;
  const meta = document.createElement("p");
  meta.className = "game-hud__meta";
  meta.textContent = `${input.seed64} · Revision ${input.revision}`;
  identity.append(name, meta);

  const actions = document.createElement("div");
  actions.className = "game-hud__actions";
  const save = createButton({
    label: "Save city",
    variant: "secondary",
    onPress: input.onSave,
  });
  const exit = createButton({
    label: "Exit city",
    variant: "ghost",
    onPress: input.onExit,
  });
  const status = document.createElement("span");
  status.className = "game-hud__status";
  status.setAttribute("aria-live", "polite");
  actions.append(status, save.element, exit.element);
  hud.append(identity, actions);

  const debug = document.createElement("details");
  debug.className = "game-debug";
  const debugSummary = document.createElement("summary");
  const debugSummaryText = document.createElement("span");
  debugSummaryText.textContent = "Terrain Debug · 0 active";
  debugSummary.append(debugSummaryText);
  const debugBody = document.createElement("div");
  debugBody.className = "game-debug__body";
  const switches = DEBUG_OPTIONS.map(({ layer, label, description }) => {
    const entry = createSwitch({
      id: `game-debug-${layer}`,
      label,
      onChange: (checked) => input.onDebugChange(layer, checked),
    });
    const detail = document.createElement("span");
    detail.className = "game-debug__description";
    detail.textContent = description;
    entry.element.append(detail);
    return entry;
  });
  const clearDebug = createButton({
    label: "Clear debug",
    variant: "ghost",
    onPress: input.onClearDebug,
  });
  clearDebug.element.disabled = true;
  clearDebug.element.classList.add("game-debug__clear");
  debugBody.append(
    ...switches.map((entry) => entry.element),
    clearDebug.element,
  );
  debug.append(debugSummary, debugBody);

  const pickStatus = document.createElement("div");
  pickStatus.className = "game-pick-status";
  pickStatus.setAttribute("aria-live", "polite");
  element.append(viewport, hud, debug, pickStatus);

  let disposed = false;
  const handle: GameScreenHandle = {
    element,
    viewport,
    setSaving(saving): void {
      save.element.disabled = saving;
      exit.element.disabled = saving;
      status.textContent = saving ? "Saving…" : status.textContent;
    },
    setSaveStatus(message): void {
      status.textContent = message ?? "";
    },
    setPickStatus(message): void {
      pickStatus.textContent = message;
    },
    setDebugLayers(layers): void {
      const active = new Set(layers);
      for (const [index, option] of DEBUG_OPTIONS.entries()) {
        switches[index]!.input.checked = active.has(option.layer);
      }
      debugSummaryText.textContent = `Terrain Debug · ${layers.length} active`;
      clearDebug.element.disabled = layers.length === 0;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      save.dispose();
      exit.dispose();
      clearDebug.dispose();
      for (const item of switches) item.dispose();
    },
  };
  return Object.freeze(handle);
}
