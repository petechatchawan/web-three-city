import type { ArchitectureReport } from "./model";

function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return count === 1 ? singular : pluralForm;
}

export function exitCodeForReport(report: ArchitectureReport): 0 | 1 {
  return report.violations.length === 0 ? 0 : 1;
}

export function formatReport(report: ArchitectureReport): string {
  if (report.violations.length === 0) {
    return `Architecture check passed: ${report.packages.length} ${plural(report.packages.length, "package")}, ${report.edges.length} ${plural(report.edges.length, "edge")}, 0 violations.`;
  }

  const lines: string[] = [];
  for (const item of report.violations) {
    const target = item.target ? ` -> ${item.target}` : "";
    lines.push(
      `[${item.ruleId}] ${item.source}${target}`,
      `  ${item.message}`,
      `  See: ${item.reference}`,
    );
  }
  lines.push(
    `Architecture check failed: ${report.violations.length} ${plural(report.violations.length, "violation")}.`,
  );
  return lines.join("\n");
}
