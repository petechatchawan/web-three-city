import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import type { PackageProfile, WorkspacePackage } from "./model";

interface WorkspaceDiscovery {
  readonly patterns: readonly string[];
  readonly packages: readonly WorkspacePackage[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function firstExportTarget(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const target = firstExportTarget(item);
      if (target) return target;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  for (const preferred of ["types", "import", "default", "require"]) {
    const target = firstExportTarget(value[preferred]);
    if (target) return target;
  }
  for (const nested of Object.values(value)) {
    const target = firstExportTarget(nested);
    if (target) return target;
  }
  return undefined;
}

function normalizeExports(value: unknown): Record<string, string> {
  if (typeof value === "string") return { ".": value };
  if (!isRecord(value)) return {};
  const keys = Object.keys(value);
  if (!keys.some((key) => key.startsWith("."))) {
    const root = firstExportTarget(value);
    return root ? { ".": root } : {};
  }
  const result: Record<string, string> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (!key.startsWith(".")) continue;
    const target = firstExportTarget(nested);
    if (target) result[key] = target;
  }
  return result;
}

export function profileForRelativeRoot(relativeRoot: string): PackageProfile {
  const namespace = relativeRoot.split("/")[0];
  switch (namespace) {
    case "systems":
      return "system";
    case "foundation":
      return "foundation";
    case "orchestration":
      return "orchestration";
    case "apps":
      return "app";
    case "testkit":
      return "testkit";
    case "tooling":
      return "tooling";
    default:
      return "unknown";
  }
}

export function expectedPackageName(relativeRoot: string): string | undefined {
  const [namespace, name] = relativeRoot.split("/");
  if (!namespace || !name) return undefined;
  switch (namespace) {
    case "systems":
      return `@web-three-city/${name}`;
    case "foundation":
      return `@web-three-city/foundation-${name}`;
    case "orchestration":
      return `@web-three-city/orchestration-${name}`;
    case "apps":
      return `@web-three-city/app-${name}`;
    case "testkit":
      return `@web-three-city/testkit-${name}`;
    case "tooling":
      return `@web-three-city/tooling-${name}`;
    default:
      return undefined;
  }
}

async function readManifest(
  packageRoot: string,
  relativeRoot: string,
): Promise<WorkspacePackage> {
  const raw = JSON.parse(
    await readFile(path.join(packageRoot, "package.json"), "utf8"),
  ) as unknown;
  if (!isRecord(raw) || typeof raw.name !== "string") {
    throw new Error(
      `Workspace package ${relativeRoot} must declare a string package name.`,
    );
  }
  return {
    name: raw.name,
    root: packageRoot,
    relativeRoot,
    profile: profileForRelativeRoot(relativeRoot),
    exports: normalizeExports(raw.exports),
    dependencies: asStringRecord(raw.dependencies),
    devDependencies: asStringRecord(raw.devDependencies),
    peerDependencies: asStringRecord(raw.peerDependencies),
    optionalDependencies: asStringRecord(raw.optionalDependencies),
  };
}

async function rootsForPattern(
  root: string,
  pattern: string,
): Promise<string[]> {
  const normalized = pattern.replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized.includes("*")) {
    return (await exists(path.join(root, normalized, "package.json")))
      ? [normalized]
      : [];
  }
  if (!normalized.endsWith("/*") || normalized.slice(0, -2).includes("*")) {
    throw new Error(
      `Unsupported workspace pattern: ${pattern}. Bootstrap architecture expects one-level namespace globs.`,
    );
  }
  const parent = normalized.slice(0, -2);
  const absoluteParent = path.join(root, parent);
  if (!(await exists(absoluteParent))) return [];
  const entries = await readdir(absoluteParent, { withFileTypes: true });
  const roots: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const relativeRoot = `${parent}/${entry.name}`;
    if (await exists(path.join(root, relativeRoot, "package.json")))
      roots.push(relativeRoot);
  }
  return roots.sort();
}

export async function discoverWorkspace(
  root: string,
): Promise<WorkspaceDiscovery> {
  const workspaceFile = path.join(root, "pnpm-workspace.yaml");
  const document = parse(await readFile(workspaceFile, "utf8")) as unknown;
  if (!isRecord(document) || !Array.isArray(document.packages)) {
    throw new Error("pnpm-workspace.yaml must declare a packages array.");
  }
  const patterns = document.packages.filter(
    (value): value is string => typeof value === "string",
  );
  const relativeRoots = new Set<string>();
  for (const pattern of patterns) {
    for (const relativeRoot of await rootsForPattern(root, pattern))
      relativeRoots.add(relativeRoot);
  }
  const packages: WorkspacePackage[] = [];
  for (const relativeRoot of [...relativeRoots].sort()) {
    packages.push(
      await readManifest(path.join(root, relativeRoot), relativeRoot),
    );
  }
  return { patterns: [...patterns].sort(), packages };
}
