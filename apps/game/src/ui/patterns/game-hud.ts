import { createMetric, type MetricViewState } from "../components/metric";
import type { StatefulUiHandle } from "../primitives/types";

export interface GameHudMetricViewState extends MetricViewState {
  readonly id: string;
  readonly priority?: "critical" | "primary" | "secondary";
}

export interface GameHudViewState {
  readonly cityLabel?: string;
  readonly metrics: readonly GameHudMetricViewState[];
  readonly actions: readonly HTMLElement[];
}

export type GameHudHandle = StatefulUiHandle<GameHudViewState>;

export function createGameHud(): GameHudHandle {
  const element = document.createElement("header");
  element.className = "game-hud-pattern";
  const identity = document.createElement("div");
  identity.className = "game-hud-pattern__identity";
  const cityLabel = document.createElement("h1");
  cityLabel.className = "game-hud-pattern__city-label";
  identity.append(cityLabel);
  const metrics = document.createElement("div");
  metrics.className = "game-hud-pattern__metrics";
  const actions = document.createElement("div");
  actions.className = "game-hud-pattern__actions";
  element.append(identity, metrics, actions);
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
      actions.replaceChildren(...state.actions);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const handle of metricHandles.values()) handle.dispose();
      metricHandles.clear();
      metrics.replaceChildren();
      actions.replaceChildren();
    },
  });
}
