import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const APP_ROOT = resolve(import.meta.dirname, "../src");

function filesUnder(directory: string): string[] {
  const absolute = resolve(APP_ROOT, directory);
  const results: string[] = [];
  for (const entry of readdirSync(absolute)) {
    const path = resolve(absolute, entry);
    if (statSync(path).isDirectory())
      results.push(...filesUnder(`${directory}/${entry}`));
    else results.push(path);
  }
  return results;
}

function relative(path: string): string {
  return path.slice(APP_ROOT.length + 1);
}

describe("Game UI Foundation architecture", () => {
  test("generic UI layers do not import gameplay systems", () => {
    const files = [
      "ui/foundation",
      "ui/primitives",
      "ui/components",
      "ui/patterns",
    ]
      .flatMap(filesUnder)
      .filter((path) => path.endsWith(".ts"));
    const violations = files.flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return /@web-three-city\/(terraform|terrain|world|orchestration-city-session)/.test(
        source,
      )
        ? [relative(path)]
        : [];
    });
    expect(violations).toEqual([]);
  });

  test("raw numeric z-index values exist only in the token owner", () => {
    const files = filesUnder(".").filter((path) => path.endsWith(".css"));
    const violations = files.flatMap((path) => {
      if (relative(path) === "ui/styles/tokens.css") return [];
      const source = readFileSync(path, "utf8");
      return /z-index:\s*\d+/.test(source) ? [relative(path)] : [];
    });
    expect(violations).toEqual([]);
  });

  test("feature tools do not redefine generic button styling", () => {
    const files = filesUnder("ui/tools").filter((path) =>
      path.endsWith(".css"),
    );
    const violations = files.flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return /\.ui-button(?:\s|\{|[.:#[>+~])/.test(source)
        ? [relative(path)]
        : [];
    });
    expect(violations).toEqual([]);
  });
});
