import path from "node:path";
import { discoverWorkspace } from "./discover-workspace";
import type { ArchitectureReport, ArchitectureViolation } from "./model";
import { loadArchitecturePolicy } from "./policy";
import { checkDocumentRules } from "./rules/document-rules";
import { checkGraphRules } from "./rules/graph-rules";
import { checkImportRules } from "./rules/import-rules";
import { checkInternalRules } from "./rules/internal-rules";
import { checkPackageRules } from "./rules/package-rules";
import { analyzeSources } from "./source-analysis";

export type {
  ArchitectureEdge,
  ArchitecturePolicy,
  ArchitectureReport,
  ArchitectureViolation,
  PackageProfile,
  WorkspacePackage,
} from "./model";

function sortViolations(
  violations: readonly ArchitectureViolation[],
): ArchitectureViolation[] {
  return [...violations].sort((a, b) => {
    const left = `${a.ruleId}\0${a.source}\0${a.target ?? ""}\0${a.message}`;
    const right = `${b.ruleId}\0${b.source}\0${b.target ?? ""}\0${b.message}`;
    return left.localeCompare(right);
  });
}

export async function checkArchitecture(
  repositoryRoot: string,
): Promise<ArchitectureReport> {
  const root = path.resolve(repositoryRoot);
  const discovery = await discoverWorkspace(root);
  const policy = await loadArchitecturePolicy(root);
  const analysis = await analyzeSources(root, discovery.packages);
  const importResult = checkImportRules(
    discovery.packages,
    analysis.imports,
    policy,
  );
  const violations: ArchitectureViolation[] = [
    ...checkPackageRules(discovery.packages, policy),
    ...importResult.violations,
    ...checkGraphRules(discovery.packages, importResult.edges),
    ...(await checkInternalRules(discovery.packages, analysis)),
    ...(await checkDocumentRules(root)),
  ];

  return {
    packages: discovery.packages
      .map((pkg) => ({
        name: pkg.name,
        path: pkg.relativeRoot,
        profile: pkg.profile,
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    edges: [...importResult.edges].sort((a, b) =>
      `${a.from}\0${a.to}\0${a.surface}\0${a.sourceFile}`.localeCompare(
        `${b.from}\0${b.to}\0${b.surface}\0${b.sourceFile}`,
      ),
    ),
    violations: sortViolations(violations),
  };
}
