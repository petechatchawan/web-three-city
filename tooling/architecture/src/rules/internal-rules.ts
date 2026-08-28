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

async function collectForbiddenImports(
  source: ts.SourceFile,
  file: string,
): Promise<Map<string, string>> {
  const forbiddenImports = new Map<string, string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith(".")) continue;
    const target = await resolveLocalModule(file, specifier);
    if (!target || !pathHasSegment(target, forbiddenPublicSegments)) continue;
    for (const name of importedNames(statement))
      forbiddenImports.set(name, target);
  }
  return forbiddenImports;
}

function relativeExportSpecifier(statement: ts.Statement): string | undefined {
  if (!ts.isExportDeclaration(statement)) return undefined;
  const moduleSpecifier = statement.moduleSpecifier;
  if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier))
    return undefined;
  return moduleSpecifier.text.startsWith(".")
    ? moduleSpecifier.text
    : undefined;
}

function isSystemRootMutationExport(
  pkg: WorkspacePackage,
  surface: string,
  target: string,
): boolean {
  if (surface !== "." || pkg.profile !== "system") return false;
  return /(^|\/)(commands?|composition)(\/|\.|$)/.test(
    target.replaceAll("\\", "/"),
  );
}

function containsIdentifier(node: ts.Node, name: string): boolean {
  if (ts.isIdentifier(node) && node.text === name) return true;
  let found = false;
  node.forEachChild((child) => {
    if (!found && containsIdentifier(child, name)) found = true;
  });
  return found;
}

function checkExportedStatementImports(
  statement: ts.Statement,
  file: string,
  pkg: WorkspacePackage,
  forbiddenImports: ReadonlyMap<string, string>,
  violations: ArchitectureViolation[],
): void {
  if (!hasExportModifier(statement)) return;
  for (const [name, target] of forbiddenImports) {
    if (!containsIdentifier(statement, name)) continue;
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

async function inspectExportDeclaration(
  pkg: WorkspacePackage,
  surface: string,
  file: string,
  statement: ts.Statement,
  visited: Set<string>,
  violations: ArchitectureViolation[],
): Promise<boolean> {
  const specifier = relativeExportSpecifier(statement);
  if (!specifier) return false;
  const target = await resolveLocalModule(file, specifier);
  if (!target) return true;

  if (isSystemRootMutationExport(pkg, surface, target)) {
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
    return true;
  }

  await scanPublicModule(pkg, surface, target, visited, violations);
  return true;
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
  const forbiddenImports = await collectForbiddenImports(source, file);

  for (const statement of source.statements) {
    const handled = await inspectExportDeclaration(
      pkg,
      surface,
      file,
      statement,
      visited,
      violations,
    );
    if (handled) continue;
    checkExportedStatementImports(
      statement,
      file,
      pkg,
      forbiddenImports,
      violations,
    );
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
