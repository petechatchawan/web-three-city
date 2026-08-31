import { describe, expect, it, vi } from "vitest";
import type { NormalizedPointerEvent } from "../src/presentation/input/gesture-recognizer";
import { createTerraformPointerSession } from "../src/composition/terraform/terraform-pointer-session";

function event(
  type: NormalizedPointerEvent["type"],
  patch: Partial<NormalizedPointerEvent> = {},
): NormalizedPointerEvent {
  return {
    type,
    id: 1,
    pointerType: "mouse",
    button: 0,
    x: 10,
    y: 10,
    ...patch,
  };
}

describe("Terraform pointer session", () => {
  it("previews mouse hover without an active pointer", () => {
    const preview = vi.fn();
    const clear = vi.fn();
    const session = createTerraformPointerSession({
      tapThresholdPixels: 9,
      onPreviewClientPoint: preview,
      onClearPreview: clear,
    });

    session.onPointerEvent(event("move", { x: 42, y: 27 }));

    expect(preview).toHaveBeenCalledWith(42, 27);
    expect(clear).not.toHaveBeenCalled();
  });

  it("keeps a primary candidate through <=9px movement and cancels beyond threshold", () => {
    const preview = vi.fn();
    const clear = vi.fn();
    const session = createTerraformPointerSession({
      tapThresholdPixels: 9,
      onPreviewClientPoint: preview,
      onClearPreview: clear,
    });

    session.onPointerEvent(event("down", { x: 10, y: 10 }));
    session.onPointerEvent(event("move", { x: 19, y: 10 }));
    expect(clear).not.toHaveBeenCalled();

    session.onPointerEvent(event("move", { x: 20, y: 10 }));
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("never starts a Terraform candidate for right mouse button", () => {
    const preview = vi.fn();
    const clear = vi.fn();
    const session = createTerraformPointerSession({
      tapThresholdPixels: 9,
      onPreviewClientPoint: preview,
      onClearPreview: clear,
    });

    session.onPointerEvent(event("down", { button: 2 }));

    expect(preview).not.toHaveBeenCalled();
  });

  it("cancels first-touch candidate immediately when a second touch appears", () => {
    const preview = vi.fn();
    const clear = vi.fn();
    const session = createTerraformPointerSession({
      tapThresholdPixels: 9,
      onPreviewClientPoint: preview,
      onClearPreview: clear,
    });

    session.onPointerEvent(
      event("down", { id: 1, pointerType: "touch", x: 10, y: 10 }),
    );
    expect(preview).toHaveBeenCalledWith(10, 10);

    session.onPointerEvent(
      event("down", { id: 2, pointerType: "touch", x: 20, y: 10 }),
    );
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("owns no commit callback and only manages preview lifecycle", () => {
    const session = createTerraformPointerSession({
      tapThresholdPixels: 9,
      onPreviewClientPoint: vi.fn(),
      onClearPreview: vi.fn(),
    });

    expect(Object.keys(session).sort()).toEqual(["dispose", "onPointerEvent"]);
  });
});
