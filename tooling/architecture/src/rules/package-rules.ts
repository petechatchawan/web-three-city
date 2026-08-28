import path from "node:path";
import type {
  ArchitecturePolicy,
  ArchitectureViolation,
  WorkspacePackage,
} from "../model";
import { expectedPackageName } from "../discover-workspace";

function violation(
  ruleId: string,
  source: string,
  message: string,
  reference: string,
  target?: string,
): ArchitectureViolation {
  return { ruleId, source, message, reference, ...(target ? { target } : {}) };
}

export function checkPackageRules(
  packages: readonly WorkspacePackage[],
  policy: ArchitecturePolicy,
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  for (const pkg of packages) {
    if (pkg.profile === "unknown") {
      violations.push(
        violation(
          "ARCH-WORKSPACE-001",
          pkg.relativeRoot,
          "Workspace package is outside an approved A3 ownership namespace.",
          "A3 § Canonical Repository Topology",
        ),
      );
      continue;
    }
    const expected = expectedPackageName(pkg.relativeRoot);
    const deviation = policy.packageNameDeviations.some(
      (entry) => entry.path === pkg.relativeRoot && entry.name === pkg.name,
    );
    if (expected && pkg.name !== expected && !deviation) {
      violations.push(
        violation(
          "ARCH-PKG-001",
          pkg.relativeRoot,
          `Package name ${pkg.name} does not match the A4 default identity ${expected} and has no approved deviation.`,
          "A4 § Package Identity",
        ),
      );
    }
  }

  const sorted = [...packages].sort((a, b) => a.root.length - b.root.length);
  for (let index = 0; index < sorted.length; index += 1) {
    const outer = sorted[index];
    if (!outer) continue;
    for (const inner of sorted.slice(index + 1)) {
      if (inner.root.startsWith(`${outer.root}${path.sep}`)) {
        violations.push(
          violation(
            "ARCH-WORKSPACE-002",
            inner.relativeRoot,
            `Nested workspace package is inside ${outer.relativeRoot} without a package-split architecture boundary.`,
            "A3 § Package Creation / Split Rules",
            outer.relativeRoot,
          ),
        );
      }
    }
  }
  return violations;
}
