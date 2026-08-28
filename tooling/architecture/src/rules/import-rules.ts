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

interface PermissionContext {
  readonly source: WorkspacePackage;
  readonly target: WorkspacePackage;
  readonly surface: string;
  readonly sourceFile: string;
  readonly sourceKind: SourceImport["sourceKind"];
  readonly policy: ArchitecturePolicy;
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

function systemToSystemPermission(
  context: PermissionContext,
): ArchitectureViolation[] {
  const { source, target, surface, sourceFile, sourceKind, policy } = context;
  if (surface === "./commands") {
    return [
      violation(
        "ARCH-SYS-002",
        sourceFile,
        "A production system may not import another system command surface.",
        "ADR-001 / A6 § System Surface Permission Matrix",
        target.name,
      ),
    ];
  }
  if (surface === "./composition") {
    return [
      violation(
        "ARCH-SYS-003",
        sourceFile,
        "A production system may not import another system composition surface.",
        "A6 § System Surface Permission Matrix",
        target.name,
      ),
    ];
  }
  if (
    surface === "." &&
    sourceKind === "production" &&
    !edgeIsApproved(policy.approvedSystemReadEdges, source.name, target.name)
  ) {
    return [
      violation(
        "ARCH-SYS-001",
        sourceFile,
        `Direct system read ${source.name} -> ${target.name} is not explicitly approved.`,
        "A3 / A6 § System-to-System Read Dependency Review",
        target.name,
      ),
    ];
  }
  return [];
}

function foundationPermission(
  context: PermissionContext,
): ArchitectureViolation[] {
  if (context.target.profile === "foundation") return [];
  return [
    violation(
      "ARCH-FOUNDATION-001",
      context.sourceFile,
      `Foundation may not depend upward on ${context.target.profile} package ${context.target.name}.`,
      "A8 § Foundation Dependency Direction",
      context.target.name,
    ),
  ];
}

function systemPermission(context: PermissionContext): ArchitectureViolation[] {
  if (context.target.profile === "system")
    return systemToSystemPermission(context);
  const forbidden = new Set(["orchestration", "app", "testkit", "tooling"]);
  if (!forbidden.has(context.target.profile)) return [];
  return [
    violation(
      "ARCH-NS-001",
      context.sourceFile,
      `System package may not depend on ${context.target.profile} package ${context.target.name}.`,
      "A3 § Dependency Permission Model",
      context.target.name,
    ),
  ];
}

function orchestrationPermission(
  context: PermissionContext,
): ArchitectureViolation[] {
  const { source, target, surface, sourceFile, policy } = context;
  if (target.profile === "system" && surface === "./composition") {
    return [
      violation(
        "ARCH-ORCH-001",
        sourceFile,
        "Orchestration may consume system read/command APIs but not system composition internals.",
        "A6 / A7 § Orchestration",
        target.name,
      ),
    ];
  }
  if (
    target.profile === "orchestration" &&
    !edgeIsApproved(policy.approvedSameLayerEdges, source.name, target.name)
  ) {
    return [
      violation(
        "ARCH-ORCH-002",
        sourceFile,
        "Orchestration-to-orchestration dependency is forbidden by default and is not approved.",
        "A6 / A7 § Orchestration Dependency Graph",
        target.name,
      ),
    ];
  }
  const forbidden = new Set(["app", "testkit", "tooling"]);
  if (!forbidden.has(target.profile)) return [];
  return [
    violation(
      "ARCH-NS-001",
      sourceFile,
      `Orchestration package may not depend on ${target.profile} package ${target.name}.`,
      "A3 § Dependency Permission Model",
      target.name,
    ),
  ];
}

function appPermission(context: PermissionContext): ArchitectureViolation[] {
  const { source, target, sourceFile, policy } = context;
  if (
    target.profile === "app" &&
    !edgeIsApproved(policy.approvedSameLayerEdges, source.name, target.name)
  ) {
    return [
      violation(
        "ARCH-APP-001",
        sourceFile,
        "App-to-app dependency is forbidden by default and is not approved.",
        "A6 § Application Exports",
        target.name,
      ),
    ];
  }
  if (target.profile !== "testkit" && target.profile !== "tooling") return [];
  return [
    violation(
      "ARCH-NS-001",
      sourceFile,
      `Application production code may not depend on ${target.profile} package ${target.name}.`,
      "A3 / A6",
      target.name,
    ),
  ];
}

function testkitPermission(context: PermissionContext): ArchitectureViolation[] {
  const { target, surface, sourceFile } = context;
  if (target.profile === "system" && surface !== ".") {
    return [
      violation(
        "ARCH-TEST-001",
        sourceFile,
        "testkit receives no privileged system command/composition access.",
        "A6 § Testkit Exports / A9 § testkit",
        target.name,
      ),
    ];
  }
  const forbidden = new Set(["app", "orchestration", "tooling"]);
  if (!forbidden.has(target.profile)) return [];
  return [
    violation(
      "ARCH-NS-001",
      sourceFile,
      `testkit package may not depend on ${target.profile} package ${target.name}.`,
      "A6 / A9",
      target.name,
    ),
  ];
}

function toolingPermission(context: PermissionContext): ArchitectureViolation[] {
  if (context.target.profile === "tooling") return [];
  return [
    violation(
      "ARCH-TOOLING-001",
      context.sourceFile,
      `Repository tooling inspection rights do not imply a runtime code dependency on ${context.target.name}.`,
      "A4 / A6 § Tooling Exports",
      context.target.name,
    ),
  ];
}

function checkNamespacePermission(
  context: PermissionContext,
): ArchitectureViolation[] {
  if (context.source.name === context.target.name) return [];
  switch (context.source.profile) {
    case "foundation":
      return foundationPermission(context);
    case "system":
      return systemPermission(context);
    case "orchestration":
      return orchestrationPermission(context);
    case "app":
      return appPermission(context);
    case "testkit":
      return testkitPermission(context);
    case "tooling":
      return toolingPermission(context);
    case "unknown":
      return [];
  }
}

function boundaryViolations(
  entry: SourceImport,
  targetPackage: WorkspacePackage | undefined,
): ArchitectureViolation[] {
  if (!targetPackage) return [];
  const result: ArchitectureViolation[] = [];
  if (entry.relativeCrossPackage) {
    result.push(
      violation(
        "ARCH-IMPORT-001",
        entry.sourceFile,
        "Relative filesystem import crosses a package root and bypasses the declared export boundary.",
        "A4 § Deep Import Definition",
        targetPackage.name,
      ),
    );
  }
  if (
    entry.targetSurface &&
    !entry.relativeCrossPackage &&
    !(entry.targetSurface in targetPackage.exports)
  ) {
    result.push(
      violation(
        "ARCH-EXPORT-001",
        entry.sourceFile,
        `Target surface ${entry.targetSurface} is not declared in ${targetPackage.name} package.json exports.`,
        "A4 § Boundary Mechanism / A6",
        targetPackage.name,
      ),
    );
  }
  return result;
}

function productionDependencyViolation(
  sourcePackage: WorkspacePackage,
  dependency: string,
  sourceFile: string,
  thirdParty: boolean,
): ArchitectureViolation | undefined {
  if (isProductionDeclared(sourcePackage, dependency)) return undefined;
  if (dependency in sourcePackage.devDependencies) {
    return violation(
      "ARCH-DEP-002",
      sourceFile,
      `${thirdParty ? "Production source uses third-party dependency" : "Production source uses"} ${dependency}, but it is classified as dev-only.`,
      "A4 § Dependency Declaration",
      dependency,
    );
  }
  return violation(
    "ARCH-DEP-001",
    sourceFile,
    `${thirdParty ? "Direct third-party dependency" : "Cross-package dependency"} ${dependency} is not explicitly declared.`,
    "A4 § Dependency Declaration",
    dependency,
  );
}

function workspaceDependencyViolations(
  entry: SourceImport,
  sourcePackage: WorkspacePackage,
  targetPackage: WorkspacePackage,
  policy: ArchitecturePolicy,
): ArchitectureViolation[] {
  if (sourcePackage.name === targetPackage.name) return [];
  const result: ArchitectureViolation[] = [];
  const dependency = targetPackage.name;
  if (entry.sourceKind === "production") {
    const problem = productionDependencyViolation(
      sourcePackage,
      dependency,
      entry.sourceFile,
      false,
    );
    if (problem) result.push(problem);
  } else if (!isDeclared(sourcePackage, dependency)) {
    result.push(
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
    result.push(
      ...checkNamespacePermission({
        source: sourcePackage,
        target: targetPackage,
        surface: entry.targetSurface,
        sourceFile: entry.sourceFile,
        sourceKind: entry.sourceKind,
        policy,
      }),
    );
  }
  return result;
}

function externalDependencyViolations(
  entry: SourceImport,
  sourcePackage: WorkspacePackage | undefined,
  targetPackage: WorkspacePackage | undefined,
): ArchitectureViolation[] {
  if (!sourcePackage || targetPackage) return [];
  const external = externalPackageName(entry.specifier);
  if (!external || external === sourcePackage.name) return [];
  if (entry.sourceKind === "production") {
    const problem = productionDependencyViolation(
      sourcePackage,
      external,
      entry.sourceFile,
      true,
    );
    return problem ? [problem] : [];
  }
  if (entry.sourceKind !== "package-test" || isDeclared(sourcePackage, external))
    return [];
  return [
    violation(
      "ARCH-DEP-001",
      entry.sourceFile,
      `Test dependency ${external} is not explicitly declared.`,
      "A4 / A9",
      external,
    ),
  ];
}

function edgeForImport(
  entry: SourceImport,
  sourcePackage: WorkspacePackage | undefined,
  targetPackage: WorkspacePackage | undefined,
): ArchitectureEdge | undefined {
  if (!targetPackage) return undefined;
  return {
    from: sourcePackage?.name ?? "<repository-tests>",
    to: targetPackage.name,
    surface: entry.targetSurface ?? "private",
    kind: entry.sourceKind,
    sourceFile: entry.sourceFile,
  };
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

    violations.push(...boundaryViolations(entry, targetPackage));
    if (sourcePackage && targetPackage) {
      violations.push(
        ...workspaceDependencyViolations(
          entry,
          sourcePackage,
          targetPackage,
          policy,
        ),
      );
    }
    violations.push(
      ...externalDependencyViolations(entry, sourcePackage, targetPackage),
    );

    const edge = edgeForImport(entry, sourcePackage, targetPackage);
    if (edge) edges.push(edge);
  }

  return { edges, violations };
}
