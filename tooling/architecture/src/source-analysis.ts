import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type {
  BrowserGlobalReference,
  SourceAnalysis,
  SourceImport,
  SourceKind,
  WorkspacePackage,
} from "./model";

const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);
const browserGlobals = new Set([
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
]);

function compareNames(left: string, right: string): number {
  return left.localeCompare(right);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(directory: string): Promise<string[]> {
  if (!(await exists(directory))) return [];
  const files: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (
        ["node_modules", "dist", "coverage", ".vite", "fixtures"].includes(
          entry.name,
        )
      )
        continue;
      files.push(...(await walkFiles(absolute)));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(absolute);
    }
  }
  return files;
}

function sourceKindForPackageFile(
  packageRoot: string,
  file: string,
): SourceKind {
  const relative = path.relative(packageRoot, file).replaceAll("\\", "/");
  if (
    relative.startsWith("tests/") ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(relative)
  )
    return "package-test";
  return "production";
}

function moduleSpecifierFromNode(node: ts.Node): string | undefined {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }
  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference)
  ) {
    const expression = node.moduleReference.expression;
    return expression && ts.isStringLiteral(expression)
      ? expression.text
      : undefined;
  }
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword
  ) {
    const argument = node.arguments[0];
    return argument && ts.isStringLiteral(argument) ? argument.text : undefined;
  }
  return undefined;
}

function isReferenceIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return true;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node)
    return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (
    ts.isImportSpecifier(parent) ||
    ts.isImportClause(parent) ||
    ts.isNamespaceImport(parent)
  )
    return false;
  if (
    (ts.isVariableDeclaration(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent)) &&
    parent.name === node
  ) {
    return false;
  }
  return true;
}

function findTargetPackageBySpecifier(
  specifier: string,
  packages: readonly WorkspacePackage[],
): WorkspacePackage | undefined {
  return [...packages]
    .sort((a, b) => b.name.length - a.name.length)
    .find(
      (candidate) =>
        specifier === candidate.name ||
        specifier.startsWith(`${candidate.name}/`),
    );
}

function surfaceForSpecifier(
  specifier: string,
  target: WorkspacePackage,
): string {
  if (specifier === target.name) return ".";
  return `./${specifier.slice(target.name.length + 1)}`;
}

function packageContainingPath(
  filePath: string,
  packages: readonly WorkspacePackage[],
): WorkspacePackage | undefined {
  return [...packages]
    .sort((a, b) => b.root.length - a.root.length)
    .find(
      (candidate) =>
        filePath === candidate.root ||
        filePath.startsWith(`${candidate.root}${path.sep}`),
    );
}

interface ImportResolution {
  readonly targetPackage?: WorkspacePackage;
  readonly resolvedPath?: string;
  readonly relativeCrossPackage: boolean;
  readonly targetSurface?: string;
}

function resolveImport(
  file: string,
  specifier: string,
  sourcePackage: WorkspacePackage | undefined,
  packages: readonly WorkspacePackage[],
): ImportResolution {
  let targetPackage = findTargetPackageBySpecifier(specifier, packages);
  if (!specifier.startsWith(".")) {
    return {
      relativeCrossPackage: false,
      ...(targetPackage ? { targetPackage } : {}),
      ...(targetPackage
        ? { targetSurface: surfaceForSpecifier(specifier, targetPackage) }
        : {}),
    };
  }

  const resolvedPath = path.resolve(path.dirname(file), specifier);
  const containing = packageContainingPath(resolvedPath, packages);
  const relativeCrossPackage = Boolean(
    containing && containing.name !== sourcePackage?.name,
  );
  if (relativeCrossPackage) targetPackage = containing;
  return {
    resolvedPath,
    relativeCrossPackage,
    ...(targetPackage ? { targetPackage } : {}),
    ...(relativeCrossPackage ? { targetSurface: "private" } : {}),
  };
}

function sourceImportFromNode(
  node: ts.Node,
  file: string,
  sourcePackage: WorkspacePackage | undefined,
  sourceKind: SourceKind,
  packages: readonly WorkspacePackage[],
): SourceImport | undefined {
  const specifier = moduleSpecifierFromNode(node);
  if (!specifier) return undefined;
  const resolution = resolveImport(file, specifier, sourcePackage, packages);
  return {
    sourceFile: file,
    sourceKind,
    specifier,
    relativeCrossPackage: resolution.relativeCrossPackage,
    ...(sourcePackage ? { sourcePackageName: sourcePackage.name } : {}),
    ...(resolution.targetPackage
      ? { targetPackageName: resolution.targetPackage.name }
      : {}),
    ...(resolution.targetSurface
      ? { targetSurface: resolution.targetSurface }
      : {}),
    ...(resolution.resolvedPath
      ? { resolvedPath: resolution.resolvedPath }
      : {}),
  };
}

function browserGlobalFromNode(
  node: ts.Node,
  file: string,
  sourcePackage: WorkspacePackage | undefined,
  sourceKind: SourceKind,
): BrowserGlobalReference | undefined {
  if (!sourcePackage || sourceKind !== "production" || !ts.isIdentifier(node))
    return undefined;
  if (!browserGlobals.has(node.text) || !isReferenceIdentifier(node))
    return undefined;
  return {
    sourceFile: file,
    sourcePackageName: sourcePackage.name,
    name: node.text,
  };
}

async function analyzeFile(
  file: string,
  sourcePackage: WorkspacePackage | undefined,
  sourceKind: SourceKind,
  packages: readonly WorkspacePackage[],
): Promise<{ imports: SourceImport[]; globals: BrowserGlobalReference[] }> {
  const text = await readFile(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const imports: SourceImport[] = [];
  const globals: BrowserGlobalReference[] = [];

  const visit = (node: ts.Node): void => {
    const sourceImport = sourceImportFromNode(
      node,
      file,
      sourcePackage,
      sourceKind,
      packages,
    );
    if (sourceImport) imports.push(sourceImport);

    const browserGlobal = browserGlobalFromNode(
      node,
      file,
      sourcePackage,
      sourceKind,
    );
    if (browserGlobal) globals.push(browserGlobal);
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { imports, globals };
}

function compareImports(left: SourceImport, right: SourceImport): number {
  return `${left.sourceFile}\0${left.specifier}`.localeCompare(
    `${right.sourceFile}\0${right.specifier}`,
  );
}

function compareGlobals(
  left: BrowserGlobalReference,
  right: BrowserGlobalReference,
): number {
  return `${left.sourceFile}\0${left.name}`.localeCompare(
    `${right.sourceFile}\0${right.name}`,
  );
}

export async function analyzeSources(
  root: string,
  packages: readonly WorkspacePackage[],
): Promise<SourceAnalysis> {
  const imports: SourceImport[] = [];
  const globals: BrowserGlobalReference[] = [];
  for (const pkg of packages) {
    const files = [
      ...(await walkFiles(path.join(pkg.root, "src"))),
      ...(await walkFiles(path.join(pkg.root, "tests"))),
    ];
    const uniqueFiles = [...new Set(files)].sort(compareNames);
    for (const file of uniqueFiles) {
      const result = await analyzeFile(
        file,
        pkg,
        sourceKindForPackageFile(pkg.root, file),
        packages,
      );
      imports.push(...result.imports);
      globals.push(...result.globals);
    }
  }
  for (const file of await walkFiles(path.join(root, "tests"))) {
    const result = await analyzeFile(
      file,
      undefined,
      "repository-test",
      packages,
    );
    imports.push(...result.imports);
  }
  imports.sort(compareImports);
  globals.sort(compareGlobals);
  return { imports, browserGlobals: globals };
}
