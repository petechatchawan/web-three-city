import { describe, expect, it } from "vitest";
import { UI_ICON_NAMES } from "../src/ui/foundation/icon-names";
import type { StatefulUiHandle, UiHandle } from "../src/ui/primitives/types";

const acceptsHandle = (value: UiHandle): void => {
  void value;
};
const acceptsStateful = (
  value: StatefulUiHandle<{ active: boolean }>,
): void => {
  void value;
};

describe("Game UI foundation contracts", () => {
  it("publishes stable icon names used by product surfaces", () => {
    expect(UI_ICON_NAMES).toEqual(
      expect.arrayContaining([
        "terrain",
        "roads",
        "zones",
        "buildings",
        "menu",
        "close",
        "undo",
        "save",
        "chevron-left",
      ]),
    );
  });

  it("keeps disposable/stateful handles structurally compatible", () => {
    acceptsHandle({ element: {} as HTMLElement, dispose() {} });
    acceptsStateful({
      element: {} as HTMLElement,
      render() {},
      dispose() {},
    });
    expect(true).toBe(true);
  });
});
