import type { Clock } from "@web-three-city/orchestration-city-session";

export function createBrowserClock(now: () => Date = () => new Date()): Clock {
  return Object.freeze({
    nowIso(): string {
      return now().toISOString();
    },
  });
}
