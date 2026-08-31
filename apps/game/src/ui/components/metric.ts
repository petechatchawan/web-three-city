import type { StatefulUiHandle } from "../primitives/types";

export interface MetricViewState {
  readonly label: string;
  readonly value: string;
  readonly trend?: "up" | "down" | "neutral";
}

export function createMetric(): StatefulUiHandle<MetricViewState> {
  const element = document.createElement("div");
  element.className = "ui-metric";
  const value = document.createElement("strong");
  value.className = "ui-metric__value";
  const label = document.createElement("span");
  label.className = "ui-metric__label";
  element.append(value, label);
  let disposed = false;

  return Object.freeze({
    element,
    render(state: MetricViewState): void {
      if (disposed) return;
      label.textContent = state.label;
      value.textContent = state.value;
      if (state.trend === undefined) delete element.dataset.trend;
      else element.dataset.trend = state.trend;
    },
    dispose(): void {
      disposed = true;
    },
  });
}
