import type {
  ArchitectureEdge,
  ArchitecturePolicy,
  ArchitectureViolation,
  SourceImport,
  WorkspacePackage,
} from "../model";
import { edgeIsApproved } from "../policy";

interface ImportRuleResult {
  readonly edges: readonly ArchitectureEdge[];
  readonly violations: readonly ArchitectureViolation[];
}

function violation(
  ruleId: string,
  source: string,
  message: string,
  reference: string,
  target?: string,
): ArchitectureViolation {
  return { ruleId, source, message, reference, ...(target ? { target } : {}) };
}

function externalPackageName(specifier: string): string | undefined {
  if (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("node:")
  )
    return undefined;
  const parts = specifier.split("/");
  if (specifier.startsWith("@"))
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  return parts[0];
}

function isDeclared(pkg: WorkspacePackage, dependency: string): boolean {
  return (
    dependency in pkg.dependencies ||
    dependency in pkg.devDependencies ||
    dependency in pkg.peerDependencies ||
    dependency in pkg.optionalDependencies
  );
}

function isProductionDeclared(
  pkg: WorkspacePackage,
  dependency: string,
): boolean {
  return (
    dependency in pkg.dependencies ||
    dependency in pkg.peerDependencies ||
    dependency in pkg.optionalDependencies
  );
}

function checkNamespacePermission(
  source: WorkspacePackage,
  target: WorkspacePackage,
  surface: string,
  sourceFile: string,
  policy: ArchitecturePolicy,
  sourceKind: SourceImport["sourceKind"],
): ArchitectureViolation[] {
  if (source.name === target.name) return [];
  const result: ArchitectureViolation[] = [];
  switch (source.profile) {
    case "foundation":
      if (target.profile !== "foundation") {
        result.push(
          violation(
            "ARCH-FOUNDATION-001",
            sourceFile,
            `Foundation may not depend upward on ${target.profile} package ${target.name}.`,
            "A8 § Foundation Dependency Direction",
            target.name,
          ),
        );
      }
      break;
    case "system":
      if (target.profile === "system") {
        if (surface === "./commands") {
          result.push(
            violation(
              "ARCH-SYS-002",
              sourceFile,
              "A production system may not import another system command surface.",
              "ADR-001 / A6 § System Surface Permission Matrix",
              target.name,
            ),
          );
        } else if (surface === "./composition") {
          result.push(
            violation(
              "ARCH-SYS-003",
              sourceFile,
              "A production system may not import another system composition surface.",
              "A6 § System Surface Permission Matrix",
              target.name,
            ),
          );
        } else if (
          surface === "." &&
          sourceKind === "production" &&
          !edgeIsApproved(
            policy.approvedSystemReadEdges,
            source.name,
            target.name,
          )
        ) {
          result.push(
            violation(
              "ARCH-SYS-001",
              sourceFile,
              `Direct system read ${source.name} -> ${target.name} is not explicitly approved.`,
              "A3 / A6 § System-to-System Read Dependency Review",
              target.name,
            ),
          );
        }
      } else if (
        target.profile === "orchestration" ||
        target.profile === "app" ||
        target.profile === "testkit" ||
        target.profile === "tooling"
      ) {
        result.push(
          violation(
            "ARCH-NS-001",
            sourceFile,
            `System package may not depend on ${target.profile} package ${target.name}.`,
            "A3 § Dependency Permission Model",
            target.name,
          ),
        );
      }
      break;
    case "orchestration":
      if (target.profile === "system" && surface === "./composition") {
        result.push(
          violation(
            "ARCH-ORCH-001",
            sourceFile,
            "Orchestration may consume system read/command APIs but not system composition internals.",
            "A6 / A7 § Orchestration",
            target.name,
          ),
        );
      } else if (
        target.profile === "orchestration" &&
        !edgeIsApproved(policy.approvedSameLayerEdges, source.name, target.name)
      ) {
        result.push(
          violation(
            "ARCH-ORCH-002",
            sourceFile,
            "Orchestration-to-orchestration dependency is forbidden by default and is not approved.",
            "A6 / A7 § Orchestration Dependency Graph",
            target.name,
          ),
        );
      } else if (
        target.profile === "app" ||
        target.profile === "testkit" ||
        target.profile === "tooling"
      ) {
        result.push(
          violation(
            "ARCH-NS-001",
            sourceFile,
            `Orchestration package may not depend on ${target.profile} package ${target.name}.`,
            "A3 § Dependency Permission Model",
            target.name,
          ),
        );
      }
      break;
    case "app":
      if (
        target.profile === "app" &&
        !edgeIsApproved(policy.approvedSameLayerEdges, source.name, target.name)
      ) {
        result.push(
          violation(
            "ARCH-APP-001",
            sourceFile,
            "App-to-app dependency is forbidden by default and is not approved.",
            "A6 § Application Exports",
            target.name,
          ),
        );
      } else if (target.profile === "testkit" || target.profile === "tooling") {
        result.push(
          violation(
            "ARCH-NS-001",
            sourceFile,
            `Application production code may not depend on ${target.profile} package ${target.name}.`,
            "A3 / A6",
            target.name,
          ),
        );
      }
      break;
    case "testkit":
      if (target.profile === "system" && surface !== ".") {
        result.push(
          violation(
            "ARCH-TEST-001",
            sourceFile,
            "testkit receives no privileged system command/composition access.",
            "A6 § Testkit Exports / A9 § testkit",
            target.name,
          ),
        );
      } else if (
        target.profile === "app" ||
        target.profile === "orchestration" ||
        target.profile === "tooling"
      ) {
        result.push(
          violation(
            "ARCH-NS-001",
            sourceFile,
            `testkit package may not depend on ${target.profile} package ${target.name}.`,
            "A6 / A9",
            target.name,
          ),
        );
      }
      break;
    case "tooling":
      if (target.profile !== "tooling") {
        result.push(
          violation(
            "ARCH-TOOLING-001",
            sourceFile,
            `Repository tooling inspection rights do not imply a runtime code dependency on ${target.name}.`,
            "A4 / A6 § Tooling Exports",
            target.name,
          ),
        );
      }
      break;
    case "unknown":
      break;
  }
  return result;
}

export function checkImportRules(
  packages: readonly WorkspacePackage[],
  imports: readonly SourceImport[],
  policy: ArchitecturePolicy,
): ImportRuleResult {
  const violations: ArchitectureViolation[] = [];
  const edges: ArchitectureEdge[] = [];
  const packageByName = new Map(
    packages.map((pkg) => [pkg.name, pkg] as const),
  );

  for (const entry of imports) {
    const sourcePackage = entry.sourcePackageName
      ? packageByName.get(entry.sourcePackageName)
      : undefined;
    const targetPackage = entry.targetPackageName
      ? packageByName.get(entry.targetPackageName)
      : undefined;

    if (entry.relativeCrossPackage && targetPackage) {
      violations.push(
        violation(
          "ARCH-IMPORT-001",
          entry.sourceFile,
          "Relative filesystem import crosses a package root and bypasses the declared export boundary.",
          "A4 § Deep Import Definition",
          targetPackage.name,
        ),
      );
    }

    if (targetPackage && entry.targetSurface && !entry.relativeCrossPackage) {
      if (!(entry.targetSurface in targetPackage.exports)) {
        violations.push(
          violation(
            "ARCH-EXPORT-001",
            entry.sourceFile,
            `Target surface ${entry.targetSurface} is not declared in ${targetPackage.name} package.json exports.`,
            "A4 § Boundary Mechanism / A6",
            targetPackage.name,
          ),
        );
      }
    }

    if (
      sourcePackage &&
      targetPackage &&
      sourcePackage.name !== targetPackage.name
    ) {
      const dependency = targetPackage.name;
      if (entry.sourceKind === "production") {
        if (!isProductionDeclared(sourcePackage, dependency)) {
          if (dependency in sourcePackage.devDependencies) {
            violations.push(
              violation(
                "ARCH-DEP-002",
                entry.sourceFile,
                `Production source uses ${dependency}, but it is classified as dev-only.`,
                "A4 § Dependency Declaration",
                dependency,
              ),
            );
          } else {
            violations.push(
              violation(
                "ARCH-DEP-001",
                entry.sourceFile,
                `Cross-package dependency ${dependency} is not explicitly declared.`,
                "A4 § Dependency Declaration",
                dependency,
              ),
            );
          }
        }
      } else if (!isDeclared(sourcePackage, dependency)) {
        violations.push(
          violation(
            "ARCH-DEP-001",
            entry.sourceFile,
            `Cross-package test dependency ${dependency} is not explicitly declared.`,
            "A4 / A9",
            dependency,
          ),
        );
      }
      if (entry.targetSurface) {
        violations.push(
          ...checkNamespacePermission(
            sourcePackage,
            targetPackage,
            entry.targetSurface,
            entry.sourceFile,
            policy,
            entry.sourceKind,
          ),
        );
      }
    }

    if (sourcePackage && !targetPackage) {
      const external = externalPackageName(entry.specifier);
      if (external && external !== sourcePackage.name) {
        if (
          entry.sourceKind === "production" &&
          !isProductionDeclared(sourcePackage, external)
        ) {
          if (external in sourcePackage.devDependencies) {
            violations.push(
              violation(
                "ARCH-DEP-002",
                entry.sourceFile,
                `Production source uses third-party dependency ${external}, but it is classified as dev-only.`,
                "A4 § Dependency Declaration",
                external,
              ),
            );
          } else {
            violations.push(
              violation(
                "ARCH-DEP-001",
                entry.sourceFile,
                `Direct third-party dependency ${external} is not explicitly declared.`,
                "A4 § Dependency Declaration",
                external,
              ),
            );
          }
        } else if (
          entry.sourceKind === "package-test" &&
          !isDeclared(sourcePackage, external)
        ) {
          violations.push(
            violation(
              "ARCH-DEP-001",
              entry.sourceFile,
              `Test dependency ${external} is not explicitly declared.`,
              "A4 / A9",
              external,
            ),
          );
        }
      }
    }

    if (targetPackage) {
      edges.push({
        from: sourcePackage?.name ?? "<repository-tests>",
        to: targetPackage.name,
        surface: entry.targetSurface ?? "private",
        kind: entry.sourceKind,
        sourceFile: entry.sourceFile,
      });
    }
  }

  return { edges, violations };
}
