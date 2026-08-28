import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  AlternateInternalLayout,
  ApprovedEdge,
  ArchitecturePolicy,
  PackageNameDeviation,
} from "./model";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function edge(value: unknown): ApprovedEdge | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.from !== "string" ||
    typeof value.to !== "string" ||
    typeof value.reference !== "string"
  )
    return undefined;
  return { from: value.from, to: value.to, reference: value.reference };
}

function nameDeviation(value: unknown): PackageNameDeviation | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.path !== "string" ||
    typeof value.name !== "string" ||
    typeof value.reference !== "string"
  )
    return undefined;
  return { path: value.path, name: value.name, reference: value.reference };
}

function alternateLayout(value: unknown): AlternateInternalLayout | undefined {
  if (
    !isRecord(value) ||
    typeof value.package !== "string" ||
    typeof value.reference !== "string" ||
    !isRecord(value.mapping)
  )
    return undefined;
  const mapping = Object.fromEntries(
    Object.entries(value.mapping).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  return { package: value.package, mapping, reference: value.reference };
}

function parseArray<T>(
  value: unknown,
  parser: (entry: unknown) => T | undefined,
  label: string,
): T[] {
  if (!Array.isArray(value))
    throw new Error(`architecture.policy.json ${label} must be an array.`);
  const result: T[] = [];
  for (const item of value) {
    const parsed = parser(item);
    if (!parsed)
      throw new Error(
        `architecture.policy.json contains an invalid ${label} entry.`,
      );
    result.push(parsed);
  }
  return result;
}

export async function loadArchitecturePolicy(
  root: string,
): Promise<ArchitecturePolicy> {
  const raw = JSON.parse(
    await readFile(path.join(root, "architecture.policy.json"), "utf8"),
  ) as unknown;
  if (!isRecord(raw) || raw.version !== 1)
    throw new Error("architecture.policy.json must use schema version 1.");
  return {
    version: 1,
    approvedSystemReadEdges: parseArray(
      raw.approvedSystemReadEdges,
      edge,
      "approvedSystemReadEdges",
    ),
    approvedSameLayerEdges: parseArray(
      raw.approvedSameLayerEdges,
      edge,
      "approvedSameLayerEdges",
    ),
    packageNameDeviations: parseArray(
      raw.packageNameDeviations,
      nameDeviation,
      "packageNameDeviations",
    ),
    alternateInternalLayouts: parseArray(
      raw.alternateInternalLayouts,
      alternateLayout,
      "alternateInternalLayouts",
    ),
  };
}

export function edgeIsApproved(
  edges: readonly ApprovedEdge[],
  from: string,
  to: string,
): boolean {
  return edges.some(
    (candidate) => candidate.from === from && candidate.to === to,
  );
}
