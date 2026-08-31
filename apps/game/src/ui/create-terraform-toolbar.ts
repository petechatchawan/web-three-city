import type {
  TerraformBrushSize,
  TerraformOperation,
  TerraformStrength,
} from "@web-three-city/terraform";

export interface TerraformToolbarState {
  readonly active: boolean;
  readonly operation: TerraformOperation;
  readonly brushSize: TerraformBrushSize;
  readonly strength: TerraformStrength;
  readonly flattenTargetMeters: number | undefined;
  readonly undoDepth: number;
}

export function createTerraformToolbarState(): TerraformToolbarState {
  return Object.freeze({
    active: false,
    operation: "raise",
    brushSize: 1,
    strength: "normal",
    flattenTargetMeters: undefined,
    undoDepth: 0,
  });
}

export interface TerraformToolbarHandle {
  readonly entry: HTMLButtonElement;
  readonly tray: HTMLElement;
  setActive(active: boolean): void;
  setOperation(operation: TerraformOperation): void;
  setBrushSize(size: TerraformBrushSize): void;
  setStrength(strength: TerraformStrength): void;
  setFlattenTargetMeters(value?: number): void;
  setUndoDepth(depth: number): void;
  setStatus(message: string): void;
  dispose(): void;
}

function button(label: string, testid: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "terraform-toolbar__button";
  element.textContent = label;
  element.dataset.testid = testid;
  return element;
}

export function createTerraformToolbar(input: {
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onOperation: (operation: TerraformOperation) => void;
  readonly onBrushSize: (size: TerraformBrushSize) => void;
  readonly onStrength: (strength: TerraformStrength) => void;
  readonly onRepickLevel: () => void;
  readonly onUndo: () => void;
}): TerraformToolbarHandle {
  const disposers: (() => void)[] = [];
  const add = (element: HTMLButtonElement, listener: () => void): void => {
    element.addEventListener("click", listener);
    disposers.push(() => element.removeEventListener("click", listener));
  };

  const entry = button("Terraform", "terraform-entry");
  entry.classList.add("terraform-entry");
  add(entry, input.onOpen);

  const tray = document.createElement("section");
  tray.className = "terraform-toolbar";
  tray.dataset.testid = "terraform-toolbar";
  tray.setAttribute("aria-label", "Terraform tools");
  tray.hidden = true;

  const operationButtons = new Map<TerraformOperation, HTMLButtonElement>();
  for (const [operation, label] of [
    ["raise", "Raise"],
    ["lower", "Lower"],
    ["flatten", "Flatten"],
  ] as const) {
    const control = button(label, `terraform-operation-${operation}`);
    add(control, () => input.onOperation(operation));
    operationButtons.set(operation, control);
  }

  const brushButtons = new Map<TerraformBrushSize, HTMLButtonElement>();
  for (const size of [1, 3, 5] as const) {
    const control = button(`${size}×${size}`, `terraform-brush-${size}`);
    add(control, () => input.onBrushSize(size));
    brushButtons.set(size, control);
  }

  const strengthButtons = new Map<TerraformStrength, HTMLButtonElement>();
  for (const [strength, label] of [
    ["fine", "Fine 0.25m"],
    ["normal", "Normal 1m"],
    ["strong", "Strong 4m"],
  ] as const) {
    const control = button(label, `terraform-strength-${strength}`);
    add(control, () => input.onStrength(strength));
    strengthButtons.set(strength, control);
  }

  const target = document.createElement("span");
  target.className = "terraform-toolbar__target";
  target.dataset.testid = "terraform-flatten-target";
  target.textContent = "Level: not selected";

  const repick = button("Repick Level", "terraform-repick-level");
  add(repick, input.onRepickLevel);
  const undo = button("Undo", "terraform-undo");
  undo.disabled = true;
  add(undo, input.onUndo);
  const close = button("Close", "terraform-close");
  add(close, input.onClose);

  const status = document.createElement("span");
  status.className = "terraform-toolbar__status";
  status.dataset.testid = "terraform-status";
  status.setAttribute("aria-live", "polite");

  const groups = [
    ["Operation", [...operationButtons.values()]],
    ["Brush", [...brushButtons.values()]],
    ["Strength", [...strengthButtons.values()]],
  ] as const;
  for (const [label, controls] of groups) {
    const group = document.createElement("div");
    group.className = "terraform-toolbar__group";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);
    group.append(...controls);
    tray.append(group);
  }
  const actions = document.createElement("div");
  actions.className = "terraform-toolbar__group terraform-toolbar__actions";
  actions.append(target, repick, undo, close);
  tray.append(actions, status);

  let active = false;
  let operation: TerraformOperation = "raise";
  let brushSize: TerraformBrushSize = 1;
  let strength: TerraformStrength = "normal";
  let disposed = false;

  const sync = (): void => {
    tray.hidden = !active;
    entry.setAttribute("aria-pressed", String(active));
    for (const [key, control] of operationButtons) {
      control.setAttribute("aria-pressed", String(key === operation));
    }
    for (const [key, control] of brushButtons) {
      control.setAttribute("aria-pressed", String(key === brushSize));
    }
    for (const [key, control] of strengthButtons) {
      control.setAttribute("aria-pressed", String(key === strength));
      control.disabled = operation === "flatten";
    }
    repick.hidden = operation !== "flatten";
    target.hidden = operation !== "flatten";
  };
  sync();

  return Object.freeze({
    entry,
    tray,
    setActive(value: boolean): void {
      active = value;
      sync();
    },
    setOperation(value: TerraformOperation): void {
      operation = value;
      sync();
    },
    setBrushSize(value: TerraformBrushSize): void {
      brushSize = value;
      sync();
    },
    setStrength(value: TerraformStrength): void {
      strength = value;
      sync();
    },
    setFlattenTargetMeters(value: number | undefined): void {
      target.textContent =
        value === undefined
          ? "Level: not selected"
          : `Level: ${value.toFixed(2)}m`;
    },
    setUndoDepth(depth: number): void {
      undo.disabled = depth <= 0;
      undo.textContent = depth > 0 ? `Undo (${depth})` : "Undo";
    },
    setStatus(message: string): void {
      status.textContent = message;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const dispose of disposers) dispose();
      entry.remove();
      tray.remove();
    },
  });
}
