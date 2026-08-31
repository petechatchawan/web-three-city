import type { TerrainDebugLayer } from "@web-three-city/terrain/composition";
import { createButton } from "../../ui/primitives/button";
import { createSwitch } from "../../ui/primitives/switch";
import type { UiHandle } from "../../ui/primitives/types";

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

export interface TerrainDebugPanelHandle extends UiHandle<HTMLElement> {
  render(layers: readonly TerrainDebugLayer[], pickStatus?: string): void;
}

export function createTerrainDebugPanel(input: {
  readonly onDebugChange: (layer: TerrainDebugLayer, checked: boolean) => void;
  readonly onClearDebug: () => void;
}): TerrainDebugPanelHandle {
  const element = document.createElement("div");
  element.className = "game-debug-panel";
  const status = document.createElement("p");
  status.className = "game-debug-panel__status";
  const controls = document.createElement("div");
  controls.className = "game-debug-panel__controls";
  const switches = DEBUG_OPTIONS.map(({ layer, label, description }) => {
    const entry = createSwitch({
      id: `game-debug-${layer}`,
      label,
      onChange: (checked) => input.onDebugChange(layer, checked),
    });
    const detail = document.createElement("span");
    detail.className = "game-debug-panel__description";
    detail.textContent = description;
    entry.element.append(detail);
    return entry;
  });
  const clear = createButton({
    label: "Clear debug",
    variant: "ghost",
    onPress: input.onClearDebug,
  });
  clear.element.disabled = true;
  controls.append(...switches.map((entry) => entry.element), clear.element);
  element.append(status, controls);
  let disposed = false;

  return Object.freeze({
    element,
    render(layers: readonly TerrainDebugLayer[], pickStatus?: string): void {
      if (disposed) return;
      const active = new Set(layers);
      for (const [index, option] of DEBUG_OPTIONS.entries()) {
        switches[index]!.input.checked = active.has(option.layer);
      }
      clear.element.disabled = layers.length === 0;
      status.textContent = pickStatus ?? "";
      status.hidden = status.textContent.length === 0;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const entry of switches) entry.dispose();
      clear.dispose();
    },
  });
}
