import type { TerrainDebugLayer } from "@web-three-city/terrain/composition";
import { createButton } from "../primitives/button";
import { createSwitch } from "../primitives/switch";
import type { ScreenHandle } from "./screen-types";

const DEBUG_OPTIONS: readonly {
  readonly layer: TerrainDebugLayer;
  readonly label: string;
}[] = Object.freeze([
  { layer: "cellGrid", label: "Gameplay grid" },
  { layer: "renderSectors", label: "Render sectors" },
  { layer: "vertices", label: "Terrain vertices" },
  { layer: "triangles", label: "Triangle topology" },
  { layer: "normals", label: "Normals" },
  { layer: "elevation", label: "Elevation" },
]);

export interface GameScreenHandle extends ScreenHandle {
  readonly viewport: HTMLElement;
  setSaving(saving: boolean): void;
  setSaveStatus(message?: string): void;
  setPickStatus(message: string): void;
}

export function createGameScreen(input: {
  readonly cityName: string;
  readonly seed64: string;
  readonly revision: number;
  readonly onSave: () => void;
  readonly onExit: () => void;
  readonly onDebugChange: (layer: TerrainDebugLayer, checked: boolean) => void;
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
  debugSummary.textContent = "Terrain Debug";
  const debugBody = document.createElement("div");
  debugBody.className = "game-debug__body";
  const switches = DEBUG_OPTIONS.map(({ layer, label }) =>
    createSwitch({
      id: `game-debug-${layer}`,
      label,
      onChange: (checked) => input.onDebugChange(layer, checked),
    }),
  );
  debugBody.append(...switches.map((entry) => entry.element));
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
    dispose(): void {
      if (disposed) return;
      disposed = true;
      save.dispose();
      exit.dispose();
      for (const item of switches) item.dispose();
    },
  };
  return Object.freeze(handle);
}
