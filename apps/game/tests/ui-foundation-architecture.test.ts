import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

  test("legacy Game UI migration paths are removed and style entry is imports only", () => {
    const legacy = [
      "ui/create-terraform-toolbar.ts",
      "ui/screens/create-home-screen.ts",
      "ui/screens/create-load-city-screen.ts",
      "ui/screens/create-new-city-screen.ts",
      "ui/screens/create-game-screen.ts",
      "ui/primitives/card.ts",
      "composition/create-city-lifecycle-coordinator.ts",
    ];
    expect(
      legacy.filter((path) => existsSync(resolve(APP_ROOT, path))),
    ).toEqual([]);

    const style = readFileSync(resolve(APP_ROOT, "style.css"), "utf8");
    const nonImportLines = style
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("@import "));
    expect(nonImportLines).toEqual([]);
  });

  test("Terraform strength labels are presented from canonical domain metadata", () => {
    const view = readFileSync(
      resolve(APP_ROOT, "ui/tools/terraform/create-terraform-tool-view.ts"),
      "utf8",
    );
    expect(view).not.toMatch(/Fine 0\.25m|Normal 1m|Strong 4m/);

    const optionsPath = resolve(
      APP_ROOT,
      "ui/tools/terraform/terraform-strength-options.ts",
    );
    expect(existsSync(optionsPath)).toBe(true);
    if (!existsSync(optionsPath)) return;
    const options = readFileSync(optionsPath, "utf8");
    expect(options).toContain("strengthDeltaMeters");
    expect(options).not.toMatch(/0\.25m|1m|4m/);
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
