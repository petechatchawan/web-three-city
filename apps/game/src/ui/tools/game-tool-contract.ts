import type { UiIconName } from "../foundation/icon-names";

export type GameToolAvailability =
  | { readonly status: "available" }
  | { readonly status: "locked"; readonly reason: string }
  | { readonly status: "disabled"; readonly reason: string }
  | { readonly status: "hidden" };

export interface GameToolCategoryDescriptor {
  readonly id: string;
  readonly label: string;
  readonly order: number;
}

export interface GameToolDescriptor {
  readonly id: string;
  readonly label: string;
  readonly icon: UiIconName;
  readonly shortcut?: string;
  readonly order: number;
  readonly category: GameToolCategoryDescriptor;
}
