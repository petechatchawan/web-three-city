import { PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";
import { pointerToNdc } from "../src/presentation/interaction/pointer-to-ndc";
import { createTerrainPointerPicker } from "../src/presentation/interaction/create-terrain-pointer-picker";

const rect = { left: 100, top: 50, width: 800, height: 400 } as const;

describe("pointer picking adapter", () => {
  it("converts viewport client coordinates to NDC and rejects outside points", () => {
    expect(pointerToNdc({ clientX: 500, clientY: 250 }, rect)).toEqual({
      x: 0,
      y: 0,
    });
    expect(pointerToNdc({ clientX: 100, clientY: 50 }, rect)).toEqual({
      x: -1,
      y: 1,
    });
    expect(pointerToNdc({ clientX: 900, clientY: 450 }, rect)).toEqual({
      x: 1,
      y: -1,
    });
    expect(pointerToNdc({ clientX: 99, clientY: 50 }, rect)).toBeUndefined();
  });

  it("uses a Three Raycaster adapter and returns projection semantic result", () => {
    const camera = new PerspectiveCamera();
    const viewport = {
      getBoundingClientRect: () => rect,
    } as unknown as HTMLElement;
    const calls: unknown[] = [];
    const projection = {
      pick(raycaster: unknown) {
        calls.push(raycaster);
        return { status: "miss", reason: "NO_TERRAIN_INTERSECTION" } as const;
      },
    };
    const picker = createTerrainPointerPicker({ viewport, camera, projection });
    expect(picker.pickClientPoint(500, 250)).toEqual({
      status: "miss",
      reason: "NO_TERRAIN_INTERSECTION",
    });
    expect(calls).toHaveLength(1);
    expect(picker.pickClientPoint(10, 10)).toEqual({
      status: "miss",
      reason: "POINTER_OUTSIDE_VIEWPORT",
    });
  });
});
