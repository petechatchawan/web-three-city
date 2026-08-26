import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = path.join(
  repoRoot,
  'tooling',
  'architecture-fixtures',
  'temporal-unit-violations',
);
const TEMPORAL_TYPE_NAMES = new Set([
  'AbsoluteGameMinute',
  'GameMinuteDuration',
  'MacroHourIndex',
  'MacroHourDuration',
]);

function normalize(file) {
  return file.split(path.sep).join('/');
}

function fixture(name) {
  return path.join(fixtureRoot, name);
}

function isTrustedBoundary(file) {
  return (
    normalize(path.relative(repoRoot, file)) === 'packages/simulation-core/src/temporal-units.ts'
  );
}

async function productionFiles() {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(file);
    }
  }
  for (const root of ['packages', 'apps']) {
    for (const entry of await readdir(path.join(repoRoot, root), { withFileTypes: true })) {
      if (entry.isDirectory()) await visit(path.join(repoRoot, root, entry.name, 'src'));
    }
  }
  return files.sort();
}

function compilerOptions() {
  return {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    baseUrl: repoRoot,
    paths: { '@web-three-city/*': ['packages/*/src/index.ts'] },
  };
}

function temporalTypesInType(type, seen = new Set()) {
  if (seen.has(type)) return new Set();
  seen.add(type);
  const names = new Set();
  const aliasName = type.aliasSymbol?.name;
  const symbolName = type.symbol?.name;
  if (TEMPORAL_TYPE_NAMES.has(aliasName)) names.add(aliasName);
  if (TEMPORAL_TYPE_NAMES.has(symbolName)) names.add(symbolName);
  for (const property of type.getProperties?.() ?? []) {
    const propertyName = property.name;
    for (const candidate of TEMPORAL_TYPE_NAMES) {
      if (propertyName.includes(candidate[0].toLowerCase() + candidate.slice(1)))
        names.add(candidate);
    }
  }
  for (const nested of [
    ...(type.types ?? []),
    ...(type.intersectionTypes ?? []),
    ...(type.aliasTypeArguments ?? []),
  ]) {
    for (const name of temporalTypesInType(nested, seen)) names.add(name);
  }
  return names;
}

function isEscapedCast(node) {
  return (
    ts.isAsExpression(node.expression) && node.expression.type.kind === ts.SyntaxKind.UnknownKeyword
  );
}

function operatorCategory(operator, leftTypes, rightTypes) {
  const arithmeticOperators = new Set([
    ts.SyntaxKind.PlusToken,
    ts.SyntaxKind.MinusToken,
    ts.SyntaxKind.AsteriskToken,
    ts.SyntaxKind.SlashToken,
    ts.SyntaxKind.PercentToken,
    ts.SyntaxKind.AsteriskAsteriskToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
    ts.SyntaxKind.PercentEqualsToken,
  ]);
  const comparisonOperators = new Set([
    ts.SyntaxKind.LessThanToken,
    ts.SyntaxKind.LessThanEqualsToken,
    ts.SyntaxKind.GreaterThanToken,
    ts.SyntaxKind.GreaterThanEqualsToken,
  ]);
  const left = [...leftTypes][0];
  const right = [...rightTypes][0];
  if (left === undefined && right === undefined) return undefined;
  if (arithmeticOperators.has(operator)) {
    return left !== undefined && right !== undefined && left !== right
      ? 'temporal-incompatible-arithmetic'
      : 'temporal-raw-arithmetic';
  }
  if (comparisonOperators.has(operator)) {
    return left !== undefined && right !== undefined && left !== right
      ? 'temporal-incompatible-comparison'
      : 'temporal-raw-comparison';
  }
  return undefined;
}

function findTemporalUnitViolations({ files, root = repoRoot }) {
  const rootFiles = files.map((file) => path.resolve(root, file));
  const program = ts.createProgram(rootFiles, compilerOptions());
  const checker = program.getTypeChecker();
  const violations = [];
  const report = (node, category) => {
    const sourceFile = node.getSourceFile();
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push({
      file: path.resolve(sourceFile.fileName),
      line: position.line + 1,
      category,
    });
  };
  for (const file of rootFiles) {
    const sourceFile = program.getSourceFile(file);
    if (sourceFile === undefined || isTrustedBoundary(file)) continue;
    const visit = (node) => {
      if (ts.isAsExpression(node)) {
        const targetTypes = temporalTypesInType(checker.getTypeFromTypeNode(node.type));
        if (targetTypes.size > 0)
          report(node, isEscapedCast(node) ? 'temporal-escape-cast' : 'temporal-direct-cast');
      }
      if (ts.isBinaryExpression(node)) {
        const category = operatorCategory(
          node.operatorToken.kind,
          temporalTypesInType(checker.getTypeAtLocation(node.left)),
          temporalTypesInType(checker.getTypeAtLocation(node.right)),
        );
        if (category !== undefined) report(node, category);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return violations.sort(
    (a, b) =>
      a.file.localeCompare(b.file) || a.line - b.line || a.category.localeCompare(b.category),
  );
}

test('valid temporal usage is accepted', () => {
  const violations = findTemporalUnitViolations({ files: [fixture('valid.ts')] });
  assert.deepEqual(violations, []);
});

test('incompatible temporal operators are rejected with stable categories', () => {
  const violations = findTemporalUnitViolations({ files: [fixture('operator.ts')] });
  assert.deepEqual(
    violations.map(({ category, line }) => ({ category, line })),
    [
      { category: 'temporal-incompatible-arithmetic', line: 6 },
      { category: 'temporal-incompatible-comparison', line: 7 },
    ],
  );
});

test('direct and escaped temporal casts are rejected', () => {
  const violations = findTemporalUnitViolations({ files: [fixture('cast.ts')] });
  assert.deepEqual(
    violations.map(({ category, line }) => ({ category, line })),
    [
      { category: 'temporal-direct-cast', line: 5 },
      { category: 'temporal-escape-cast', line: 6 },
      { category: 'temporal-direct-cast', line: 9 },
    ],
  );
});

test('production temporal usage has no unapproved boundary violations', async () => {
  const violations = findTemporalUnitViolations({ files: await productionFiles() });
  assert.deepEqual(
    violations.filter(({ file }) => !isTrustedBoundary(file)),
    [],
  );
});
