import { access, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type {
  ArchitectureViolation,
  SourceAnalysis,
  SourceImport,
  WorkspacePackage,
} from "../model";

const forbiddenPublicSegments = new Set([
  "ports",
  "application",
  "composition",
  "presentation",
  "internal",
  "adapters",
]);
const outwardDomainSegments = new Set([
  "contracts",
  "ports",
  "application",
  "presentation",
  "composition",
]);

function violation(
  ruleId: string,
  source: string,
  message: string,
  reference: string,
  target?: string,
): ArchitectureViolation {
  return { ruleId, source, message, reference, ...(target ? { target } : {}) };
}

function pathHasSegment(
  filePath: string,
  segments: ReadonlySet<string>,
): boolean {
  const parts = filePath.replaceAll("\\", "/").split("/");
  return parts.some((part) => segments.has(part));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveLocalModule(
  fromFile: string,
  specifier: string,
): Promise<string | undefined> {
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.cts`,
    path.join(base, "index.ts"),
  ]) {
    if (await exists(candidate)) return candidate;
  }
  return undefined;
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    Boolean(
      ts
        .getModifiers(node)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
    )
  );
}

function importedNames(declaration: ts.ImportDeclaration): string[] {
  const clause = declaration.importClause;
  if (!clause) return [];
  const names: string[] = [];
  if (clause.name) names.push(clause.name.text);
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings))
    names.push(bindings.name.text);
  if (bindings && ts.isNamedImports(bindings))
    names.push(...bindings.elements.map((element) => element.name.text));
  return names;
}

async function scanPublicModule(
  pkg: WorkspacePackage,
  surface: string,
  file: string,
  visited: Set<string>,
  violations: ArchitectureViolation[],
): Promise<void> {
  if (visited.has(file) || !(await exists(file))) return;
  visited.add(file);
  const text = await readFile(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const forbiddenImports = new Map<string, string>();

  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith(".")
    ) {
      const target = await resolveLocalModule(
        file,
        statement.moduleSpecifier.text,
      );
      if (target && pathHasSegment(target, forbiddenPublicSegments)) {
        for (const name of importedNames(statement))
          forbiddenImports.set(name, target);
      }
    }
  }

  for (const statement of source.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith(".")
    ) {
      const target = await resolveLocalModule(
        file,
        statement.moduleSpecifier.text,
      );
      if (!target) continue;
      if (
        surface === "." &&
        pkg.profile === "system" &&
        /(^|\/)(commands?|composition)(\/|\.|$)/.test(
          target.replaceAll("\\", "/"),
        )
      ) {
        violations.push(
          violation(
            "ARCH-EXPORT-002",
            file,
            `System root read surface re-exports mutation/construction module ${path.relative(pkg.root, target)}.`,
            "A6 § Root Read Surface",
            pkg.name,
          ),
        );
      }
      if (pathHasSegment(target, forbiddenPublicSegments)) {
        violations.push(
          violation(
            "ARCH-CONTRACT-001",
            file,
            `Public surface ${surface} directly exports forbidden internal module ${path.relative(pkg.root, target)}.`,
            "A6 § Public Contract Dependency Rules",
            pkg.name,
          ),
        );
      } else {
        await scanPublicModule(pkg, surface, target, visited, violations);
      }
      continue;
    }

    if (!hasExportModifier(statement) || forbiddenImports.size === 0) continue;
    const statementText = statement.getText(source);
    for (const [name, target] of forbiddenImports) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`).test(statementText)) {
        violations.push(
          violation(
            "ARCH-CONTRACT-001",
            file,
            `Exported contract references ${name} from forbidden internal module ${path.relative(pkg.root, target)}.`,
            "A6 § Public Contract Dependency Rules",
            pkg.name,
          ),
        );
      }
    }
  }
}

function sourcePackage(
  packages: readonly WorkspacePackage[],
  name: string | undefined,
): WorkspacePackage | undefined {
  return name ? packages.find((pkg) => pkg.name === name) : undefined;
}

function checkDomainImport(
  entry: SourceImport,
  pkg: WorkspacePackage,
): ArchitectureViolation[] {
  const normalized = entry.sourceFile.replaceAll("\\", "/");
  if (!normalized.includes("/src/domain/")) return [];
  const result: ArchitectureViolation[] = [];
  if (entry.specifier === "three" || entry.specifier.startsWith("three/")) {
    result.push(
      violation(
        "ARCH-DOMAIN-002",
        entry.sourceFile,
        "System domain code may not import Three.js presentation technology.",
        "A5 § Domain Purity / A11 § Technology Boundary Checks",
        "three",
      ),
    );
  }
  if (
    entry.specifier.startsWith(".") &&
    entry.resolvedPath &&
    entry.resolvedPath.startsWith(`${pkg.root}${path.sep}`) &&
    pathHasSegment(entry.resolvedPath, outwardDomainSegments)
  ) {
    result.push(
      violation(
        "ARCH-DOMAIN-001",
        entry.sourceFile,
        `Domain code imports outward internal layer ${path.relative(pkg.root, entry.resolvedPath)}.`,
        "A5 § Internal Dependency Direction",
      ),
    );
  }
  return result;
}

export async function checkInternalRules(
  packages: readonly WorkspacePackage[],
  analysis: SourceAnalysis,
): Promise<ArchitectureViolation[]> {
  const violations: ArchitectureViolation[] = [];
  for (const entry of analysis.imports) {
    const pkg = sourcePackage(packages, entry.sourcePackageName);
    if (pkg?.profile === "system" && entry.sourceKind === "production")
      violations.push(...checkDomainImport(entry, pkg));
  }
  for (const global of analysis.browserGlobals) {
    const pkg = sourcePackage(packages, global.sourcePackageName);
    if (
      pkg?.profile === "system" &&
      global.sourceFile.replaceAll("\\", "/").includes("/src/domain/")
    ) {
      violations.push(
        violation(
          "ARCH-DOMAIN-003",
          global.sourceFile,
          `System domain code directly references browser global ${global.name}.`,
          "A5 § Domain Purity / A11 § Technology Boundary Checks",
          global.name,
        ),
      );
    }
  }
  for (const pkg of packages) {
    for (const [surface, target] of Object.entries(pkg.exports).sort(
      ([a], [b]) => a.localeCompare(b),
    )) {
      const entryFile = path.resolve(pkg.root, target);
      await scanPublicModule(
        pkg,
        surface,
        entryFile,
        new Set<string>(),
        violations,
      );
    }
  }
  return violations;
}
