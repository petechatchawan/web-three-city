import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, test } from 'vitest';

type RciTemporalSemantic =
  | 'age-origin'
  | 'macro-hour-point'
  | 'macro-hour-duration'
  | 'cycle-index'
  | 'historical-event-point';

const KNOWN_RCI_TEMPORAL_FIELDS = [
  'absoluteTick',
  'activatedAtTick',
  'afterAbsoluteTick',
  'afterTick',
  'awardedAtTick',
  'beforeAbsoluteTick',
  'beforeTick',
  'bornAtTick',
  'diedAtTick',
  'displacedAtTick',
  'displacedExpiryTicks',
  'dissolvedAtTick',
  'endedAtTick',
  'evaluatedAtTick',
  'evaluationTick',
  'expiresAfterTicks',
  'expiresAtTick',
  'foundedAtTick',
  'movedIntoCityAtTick',
  'movedOutOfCityAtTick',
  'requestedAtTick',
  'retiredAtTick',
  'startedAtTick',
  'tick',
] as const;

const RCI_TEMPORAL_FIELD_SEMANTICS: Partial<
  Record<(typeof KNOWN_RCI_TEMPORAL_FIELDS)[number], RciTemporalSemantic>
> = {
  absoluteTick: 'macro-hour-point',
  activatedAtTick: 'historical-event-point',
  afterAbsoluteTick: 'macro-hour-point',
  afterTick: 'macro-hour-point',
  awardedAtTick: 'historical-event-point',
  beforeAbsoluteTick: 'macro-hour-point',
  beforeTick: 'macro-hour-point',
  bornAtTick: 'age-origin',
  diedAtTick: 'historical-event-point',
  displacedAtTick: 'historical-event-point',
  displacedExpiryTicks: 'macro-hour-duration',
  dissolvedAtTick: 'historical-event-point',
  endedAtTick: 'historical-event-point',
  evaluatedAtTick: 'macro-hour-point',
  evaluationTick: 'macro-hour-point',
  expiresAfterTicks: 'macro-hour-duration',
  expiresAtTick: 'macro-hour-point',
  foundedAtTick: 'historical-event-point',
  movedIntoCityAtTick: 'historical-event-point',
  movedOutOfCityAtTick: 'historical-event-point',
  requestedAtTick: 'historical-event-point',
  retiredAtTick: 'historical-event-point',
  startedAtTick: 'historical-event-point',
  tick: 'historical-event-point',
};

const RCI_SOURCE_DIRECTORY = fileURLToPath(new URL('../src/', import.meta.url));

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
    })
    .sort();
}

function propertyNameText(name: ts.Node | undefined): string | undefined {
  if (name === undefined) return undefined;
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
  ) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name)) {
    const expression = name.expression;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      return expression.text;
    }
  }
  return undefined;
}

function isRciTemporalFieldName(name: string): boolean {
  return (
    name === 'tick' ||
    name === 'ticks' ||
    name.endsWith('Tick') ||
    name.endsWith('Ticks') ||
    name.endsWith('tick') ||
    name.endsWith('ticks')
  );
}

function discoverRciTemporalFields(
  sources = sourceFiles(RCI_SOURCE_DIRECTORY).map((path) => readFileSync(path, 'utf8')),
): readonly string[] {
  const fields = new Set<string>();

  for (const source of sources) {
    const sourceFile = ts.createSourceFile(
      'rci-temporal-source.ts',
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertySignature(node) ||
        ts.isPropertyDeclaration(node) ||
        ts.isPropertyAssignment(node) ||
        ts.isParameter(node)
      ) {
        const name = propertyNameText(node.name);
        if (name !== undefined && isRciTemporalFieldName(name)) fields.add(name);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return [...fields].sort();
}

test('discovers Tick/Ticks declarations without phantom comment or string matches', () => {
  const fixture = `
    // phantomCommentTick: number;
    const phantomString = 'phantomStringTicks: number';
    function supportedParameters(beforeTick: number, afterTick?: number): void {}
    interface SupportedSignatures {
      readonly tick: number;
      ticks?: number;
      readonly evaluationTick?: number;
      'displacedExpiryTicks': number;
    }
    class SupportedDeclarations {
      expiresAfterTicks!: number;
    }
  `;

  expect(discoverRciTemporalFields([fixture])).toEqual([
    'afterTick',
    'beforeTick',
    'displacedExpiryTicks',
    'evaluationTick',
    'expiresAfterTicks',
    'tick',
    'ticks',
  ]);
});

test('classifies every discovered RCI Tick/Ticks field', () => {
  const discoveredFields = discoverRciTemporalFields();
  const unclassifiedFields = discoveredFields.filter(
    (field) => !Object.hasOwn(RCI_TEMPORAL_FIELD_SEMANTICS, field),
  );

  expect(unclassifiedFields).toEqual([]);
  expect(discoveredFields).toEqual([...KNOWN_RCI_TEMPORAL_FIELDS].sort());
});
