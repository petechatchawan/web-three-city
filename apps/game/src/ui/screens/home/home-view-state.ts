import type { CitySaveSummary } from "@web-three-city/orchestration-city-session";

export interface HomeViewState {
  readonly latest?: CitySaveSummary;
  readonly cityCount: number;
  readonly phase: "idle" | "resuming";
  readonly error?: string;
}

export type HomeIntent =
  | { readonly type: "new-city" }
  | { readonly type: "load-city" }
  | { readonly type: "resume" };
