import { describe, expect, it } from "vitest";
import { createBrowserClock } from "../src/environment/create-browser-clock";
import { createBrowserIdSource } from "../src/environment/create-browser-id-source";
import { createBrowserSeedSource } from "../src/environment/create-browser-seed-source";

describe("browser environment adapters", () => {
  it("formats clock time as canonical ISO without leaking Date into orchestration", () => {
    const clock = createBrowserClock(
      () => new Date("2026-08-30T03:04:05.678Z"),
    );
    expect(clock.nowIso()).toBe("2026-08-30T03:04:05.678Z");
  });

  it("adapts randomUUID to a validated CityId", () => {
    const ids = createBrowserIdSource(
      () => "00000000-0000-4000-8000-000000000001",
    );
    expect(ids.nextCityId()).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("creates canonical uppercase Seed64 from browser entropy", () => {
    const seedSource = createBrowserSeedSource((target) => {
      target[0] = 0x01234567;
      target[1] = 0x89abcdef;
      return target;
    });
    expect(seedSource.nextSeed64()).toBe("0x0123456789ABCDEF");
    expect(seedSource.nextSeed64()).toMatch(/^0x[0-9A-F]{16}$/);
  });
});
