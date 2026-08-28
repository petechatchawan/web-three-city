import { describe, expect, test } from "vitest";
import { exitCodeForReport, formatReport } from "../src/cli-format";
import type { ArchitectureReport } from "../src/model";

const cleanReport: ArchitectureReport = {
  packages: [
    {
      name: "@web-three-city/tooling-architecture",
      path: "tooling/architecture",
      profile: "tooling",
    },
  ],
  edges: [],
  violations: [],
};

const failingReport: ArchitectureReport = {
  packages: [],
  edges: [],
  violations: [
    {
      ruleId: "ARCH-DEMO-001",
      source: "systems/alpha/src/index.ts",
      target: "@web-three-city/beta",
      message: "Demonstration architecture violation.",
      reference: "A6 § Example",
    },
  ],
};

describe("architecture CLI formatting", () => {
  test("returns zero for a clean report", () => {
    expect(exitCodeForReport(cleanReport)).toBe(0);
  });

  test("returns one when violations exist", () => {
    expect(exitCodeForReport(failingReport)).toBe(1);
  });

  test("formats clean reports with an explicit summary", () => {
    expect(formatReport(cleanReport)).toBe(
      "Architecture check passed: 1 package, 0 edges, 0 violations.",
    );
  });

  test("formats violations with stable rule, source, target, reason, and binding reference", () => {
    const output = formatReport(failingReport);
    expect(output).toContain(
      "[ARCH-DEMO-001] systems/alpha/src/index.ts -> @web-three-city/beta",
    );
    expect(output).toContain("Demonstration architecture violation.");
    expect(output).toContain("See: A6 § Example");
    expect(output).toContain("Architecture check failed: 1 violation.");
  });
});
