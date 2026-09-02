import { createMetric, type MetricViewState } from "../components/metric";
import type { StatefulUiHandle } from "../primitives/types";

export interface GameHudMetricViewState extends MetricViewState {
  readonly id: string;
  readonly priority?: "critical" | "primary" | "secondary";
}

export interface GameHudViewState {
  readonly cityLabel?: string;
  readonly metrics: readonly GameHudMetricViewState[];
  readonly simulationControls?: readonly HTMLElement[];
  readonly actions: readonly HTMLElement[];
}

export type GameHudHandle = StatefulUiHandle<GameHudViewState>;

export function createGameHud(): GameHudHandle {
  const element = document.createElement("header");
  element.className = "game-hud-pattern";
  element.dataset.density = "compact";

  const identity = document.createElement("div");
  identity.className = "game-hud-pattern__identity";
  const cityLabel = document.createElement("h1");
  cityLabel.className = "game-hud-pattern__city-label";
  identity.append(cityLabel);

  const center = document.createElement("div");
  center.className = "game-hud-pattern__center";
  center.dataset.testid = "game-hud-center";
  const metrics = document.createElement("div");
  metrics.className = "game-hud-pattern__metrics";
  const simulationControls = document.createElement("div");
  simulationControls.className = "game-hud-pattern__simulation-controls";
  simulationControls.dataset.testid = "game-hud-simulation-controls";
  center.append(metrics, simulationControls);

  const actions = document.createElement("div");
  actions.className = "game-hud-pattern__actions";
  element.append(identity, center, actions);

  const metricHandles = new Map<string, ReturnType<typeof createMetric>>();
  let disposed = false;

  return Object.freeze({
    element,
    render(state: GameHudViewState): void {
      if (disposed) return;
      cityLabel.textContent = state.cityLabel ?? "";
      identity.hidden =
        state.cityLabel === undefined || state.cityLabel.length === 0;

      const nextIds = new Set(state.metrics.map((metric) => metric.id));
      for (const [id, handle] of metricHandles) {
        if (nextIds.has(id)) continue;
        handle.dispose();
        handle.element.remove();
        metricHandles.delete(id);
      }
      for (const metric of state.metrics) {
        let handle = metricHandles.get(metric.id);
        if (handle === undefined) {
          handle = createMetric();
          metricHandles.set(metric.id, handle);
        }
        handle.render(metric);
        handle.element.dataset.priority = metric.priority ?? "primary";
        metrics.append(handle.element);
      }
      metrics.hidden = state.metrics.length === 0;

      const nextSimulationControls = state.simulationControls ?? [];
      simulationControls.replaceChildren(...nextSimulationControls);
      simulationControls.hidden = nextSimulationControls.length === 0;
      center.hidden = metrics.hidden && simulationControls.hidden;

      actions.replaceChildren(...state.actions);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const handle of metricHandles.values()) handle.dispose();
      metricHandles.clear();
      metrics.replaceChildren();
      simulationControls.replaceChildren();
      actions.replaceChildren();
    },
  });
}
