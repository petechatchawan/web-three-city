import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { ArchitectureViolation } from "../model";

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

function hasActionablePlaceholder(line: string): boolean {
  const trimmed = line.trim();
  const leadingMarker =
    /^(?:[-*+]\s+)?(?:\[[ xX]\]\s+)?(?:#{1,6}\s+)?(?:TODO|TBD|FIXME)\b(?:\s*[:—-]|\s+|$)/.test(
      trimmed,
    );
  const assignedMarker = /(?:^|[:=]\s*)(?:TODO|TBD|FIXME)\s*[.!]?\s*$/.test(
    trimmed,
  );
  return leadingMarker || assignedMarker || trimmed.includes("???");
}

export async function checkDocumentRules(
  root: string,
): Promise<ArchitectureViolation[]> {
  const violations: ArchitectureViolation[] = [];
  for (const file of await markdownFiles(
    path.join(root, "docs", "architecture"),
  )) {
    const text = await readFile(file, "utf8");
    const statusMatch = text.match(/^- \*\*Status:\*\* (.+)$/m);
    if (!statusMatch) {
      violations.push(
        violation(
          "ARCH-DOC-001",
          file,
          "Architecture document is missing the required explicit status header.",
          "A10 § Document Status Model",
        ),
      );
      continue;
    }
    if (statusMatch[1]?.trim() !== "FROZEN") continue;
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
      if (hasActionablePlaceholder(withoutInlineCode)) {
        violations.push(
          violation(
            "ARCH-DOC-002",
            `${file}:${index + 1}`,
            "FROZEN architecture prose contains an unresolved placeholder marker.",
            "A10 § No Placeholder Acceptance",
          ),
        );
      }
    }
  }
  return violations;
}
