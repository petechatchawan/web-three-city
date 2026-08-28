import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import type { SourceImport } from '../model.js';

const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/u;

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

async function collectSourceFiles(directory: string): Promise<readonly string[]> {
  const files: string[] = [];
  async function visit(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.isFile() && SOURCE_EXTENSION.test(entry.name)) files.push(fullPath);
    }
  }
  await visit(directory);
  return files;
}

function literalSpecifier(node: ts.Expression | undefined): string | undefined {
  return node !== undefined && ts.isStringLiteralLike(node) ? node.text : undefined;
}

export async function collectImportsFromDirectories(rootDir: string, directories: readonly string[]): Promise<readonly SourceImport[]> {
  const imports: SourceImport[] = [];
  const uniqueFiles = new Set<string>();
  for (const directory of directories) {
    for (const filePath of await collectSourceFiles(directory)) uniqueFiles.add(path.resolve(filePath));
  }

  for (const filePath of [...uniqueFiles].sort()) {
    const sourceText = await readFile(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function add(specifier: string, kind: SourceImport['kind'], isTypeOnly: boolean): void {
      imports.push({ sourcePath: toPosix(path.relative(rootDir, filePath)), specifier, kind, isTypeOnly });
    }
    function visit(node: ts.Node): void {
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
        const clause = node.importClause;
        const allNamedTypeOnly = clause?.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every((element) => element.isTypeOnly);
        add(node.moduleSpecifier.text, 'import', clause?.isTypeOnly === true || allNamedTypeOnly);
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteralLike(node.moduleSpecifier)) {
        add(node.moduleSpecifier.text, 'export', node.isTypeOnly);
      } else if (ts.isCallExpression(node)) {
        const specifier = literalSpecifier(node.arguments[0]);
        if (specifier !== undefined && node.expression.kind === ts.SyntaxKind.ImportKeyword) add(specifier, 'dynamic-import', false);
        else if (specifier !== undefined && ts.isIdentifier(node.expression) && node.expression.text === 'require') add(specifier, 'require', false);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }

  return imports.sort((left, right) => `${left.sourcePath}\u0000${left.specifier}\u0000${left.kind}`.localeCompare(`${right.sourcePath}\u0000${right.specifier}\u0000${right.kind}`));
}
