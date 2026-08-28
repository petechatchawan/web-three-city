import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { ArchitectureViolation } from "../model";

const placeholderMarkers = new Set(["TODO", "TBD", "FIXME"]);
const markerSeparators = new Set(["", " ", "\t", ":", "-", "—"]);

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function markdownFiles(directory: string): Promise<string[]> {
  if (!(await exists(directory))) return [];
  const files: string[] = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(absolute)));
    else if (entry.name.endsWith(".md")) files.push(absolute);
  }
  return files;
}

function violation(
  ruleId: string,
  source: string,
  message: string,
  reference: string,
): ArchitectureViolation {
  return { ruleId, source, message, reference };
}

function stripListPrefix(value: string): string {
  for (const prefix of ["- ", "* ", "+ "]) {
    if (value.startsWith(prefix)) return value.slice(prefix.length).trimStart();
  }
  return value;
}

function stripCheckboxPrefix(value: string): string {
  for (const prefix of ["[ ] ", "[x] ", "[X] "]) {
    if (value.startsWith(prefix)) return value.slice(prefix.length).trimStart();
  }
  return value;
}

function stripHeadingPrefix(value: string): string {
  let count = 0;
  while (count < 6 && value[count] === "#") count += 1;
  if (count === 0 || value[count] !== " ") return value;
  return value.slice(count + 1).trimStart();
}

function stripLeadingMarkdown(value: string): string {
  const trimmed = value.trim();
  return stripHeadingPrefix(stripCheckboxPrefix(stripListPrefix(trimmed)));
}

function startsWithPlaceholderMarker(value: string): boolean {
  for (const marker of placeholderMarkers) {
    if (!value.startsWith(marker)) continue;
    const separator = value.slice(marker.length, marker.length + 1);
    if (markerSeparators.has(separator)) return true;
  }
  return false;
}

function stripTerminalPunctuation(value: string): string {
  if (value.endsWith(".") || value.endsWith("!")) return value.slice(0, -1);
  return value;
}

function assignedPlaceholder(value: string): boolean {
  const colon = value.lastIndexOf(":");
  const equals = value.lastIndexOf("=");
  const separator = Math.max(colon, equals);
  if (separator < 0) return false;
  const candidate = stripTerminalPunctuation(value.slice(separator + 1).trim());
  return placeholderMarkers.has(candidate);
}

function hasActionablePlaceholder(line: string): boolean {
  const normalized = stripLeadingMarkdown(line);
  return (
    startsWithPlaceholderMarker(normalized) ||
    assignedPlaceholder(normalized) ||
    normalized.includes("???")
  );
}

function placeholderViolations(
  file: string,
  text: string,
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  let fenced = false;
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trimStart().startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const withoutInlineCode = line.replace(/`[^`]*`/g, "");
    if (!hasActionablePlaceholder(withoutInlineCode)) continue;
    violations.push(
      violation(
        "ARCH-DOC-002",
        `${file}:${index + 1}`,
        "FROZEN architecture prose contains an unresolved placeholder marker.",
        "A10 § No Placeholder Acceptance",
      ),
    );
  }
  return violations;
}

async function checkDocument(file: string): Promise<ArchitectureViolation[]> {
  const text = await readFile(file, "utf8");
  const statusMatch = text.match(/^- \*\*Status:\*\* (.+)$/m);
  if (!statusMatch) {
    return [
      violation(
        "ARCH-DOC-001",
        file,
        "Architecture document is missing the required explicit status header.",
        "A10 § Document Status Model",
      ),
    ];
  }
  if (statusMatch[1]?.trim() !== "FROZEN") return [];
  return placeholderViolations(file, text);
}

export async function checkDocumentRules(
  root: string,
): Promise<ArchitectureViolation[]> {
  const violations: ArchitectureViolation[] = [];
  const files = await markdownFiles(path.join(root, "docs", "architecture"));
  for (const file of files) violations.push(...(await checkDocument(file)));
  return violations;
}
