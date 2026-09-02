import type {
  TerraformBrushSize,
  TerraformOperation,
  TerraformStrength,
} from "@web-three-city/terraform";
import { createSegmentedControl } from "../../components/segmented-control";
import { createStatusIndicator } from "../../components/status-indicator";
import { createButton } from "../../primitives/button";
import type { StatefulUiHandle } from "../../primitives/types";
import { TERRAFORM_STRENGTH_OPTIONS } from "./terraform-strength-options";
import type { TerraformToolViewState } from "./terraform-tool-view-state";

export type TerraformToolViewHandle = StatefulUiHandle<TerraformToolViewState>;

function group(labelText: string, control: HTMLElement): HTMLElement {
  const element = document.createElement("div");
  element.className = "terraform-tool-view__group";
  const label = document.createElement("span");
  label.className = "terraform-tool-view__label";
  label.textContent = labelText;
  element.append(label, control);
  return element;
}

export function createTerraformToolView(input: {
  readonly onOperation: (operation: TerraformOperation) => void;
  readonly onBrushSize: (size: TerraformBrushSize) => void;
  readonly onStrength: (strength: TerraformStrength) => void;
  readonly onRepickLevel: () => void;
  readonly onUndo: () => void;
}): TerraformToolViewHandle {
  const element = document.createElement("div");
  element.className = "terraform-tool-view";
  element.dataset.testid = "terraform-tool-view";

  const operation = createSegmentedControl<TerraformOperation>({
    ariaLabel: "Terrain operation",
    items: [
      { value: "raise", label: "Raise", testId: "terraform-operation-raise" },
      { value: "lower", label: "Lower", testId: "terraform-operation-lower" },
      {
        value: "flatten",
        label: "Flatten",
        testId: "terraform-operation-flatten",
      },
    ],
    onChange: input.onOperation,
  });
  const brush = createSegmentedControl<TerraformBrushSize>({
    ariaLabel: "Terrain brush size",
    items: [
      { value: 1, label: "1×1", testId: "terraform-brush-1" },
      { value: 3, label: "3×3", testId: "terraform-brush-3" },
      { value: 5, label: "5×5", testId: "terraform-brush-5" },
    ],
    onChange: input.onBrushSize,
  });
  const strength = createSegmentedControl<TerraformStrength>({
    ariaLabel: "Terrain strength",
    items: TERRAFORM_STRENGTH_OPTIONS,
    onChange: input.onStrength,
  });

  const flattenGroup = document.createElement("div");
  flattenGroup.className =
    "terraform-tool-view__group terraform-tool-view__flatten";
  const target = document.createElement("span");
  target.className = "terraform-tool-view__target";
  target.dataset.testid = "terraform-flatten-target";
  const repick = createButton({
    label: "Repick Level",
    variant: "ghost",
    testId: "terraform-repick-level",
    onPress: input.onRepickLevel,
  });
  flattenGroup.append(target, repick.element);

  const actions = document.createElement("div");
  actions.className = "terraform-tool-view__actions";
  const undo = createButton({
    label: "Undo",
    variant: "ghost",
    testId: "terraform-undo",
    onPress: input.onUndo,
  });
  const status = createStatusIndicator();
  status.element.dataset.testid = "terraform-status";
  actions.append(undo.element, status.element);

  element.append(
    group("Operation", operation.element),
    group("Brush", brush.element),
    group("Strength", strength.element),
    flattenGroup,
    actions,
  );

  let disposed = false;
  return Object.freeze({
    element,
    render(state: TerraformToolViewState): void {
      if (disposed) return;
      operation.render({ value: state.operation, disabledValues: [] });
      brush.render({ value: state.brushSize, disabledValues: [] });
      strength.render({
        value: state.strength,
        disabledValues:
          state.operation === "flatten"
            ? (["fine", "normal", "strong"] as const)
            : [],
      });
      flattenGroup.hidden = state.operation !== "flatten";
      target.textContent =
        state.flattenTargetMeters === undefined
          ? "Level: not selected"
          : `Level: ${state.flattenTargetMeters.toFixed(2)}m`;
      undo.element.disabled = state.undoDepth <= 0;
      undo.element.textContent =
        state.undoDepth > 0 ? `Undo (${state.undoDepth})` : "Undo";
      status.render({
        message: state.message ?? "",
        severity:
          state.validity === "invalid"
            ? "warning"
            : state.validity === "valid"
              ? "success"
              : "neutral",
      });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      operation.dispose();
      brush.dispose();
      strength.dispose();
      repick.dispose();
      undo.dispose();
      status.dispose();
    },
  });
}
