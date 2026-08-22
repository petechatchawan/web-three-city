import { VerificationAuthority } from './authority.mjs';

const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareText);
}

function workspaceForSystem(system) {
  if (!system || system === 'GLOBAL' || system === 'unknown') return null;
  return `@web-three-city/${system}`;
}

function targetKey(target) {
  return `${target.workspace}:${target.mode}`;
}

function mergeTargets(targets) {
  const merged = new Map();
  for (const target of targets) {
    const key = targetKey(target);
    const existing = merged.get(key);
    if (existing) {
      existing.files = uniqueSorted([...existing.files, ...target.files]);
    } else {
      merged.set(key, { ...target, files: uniqueSorted(target.files) });
    }
  }
  return [...merged.values()].sort((left, right) => compareText(targetKey(left), targetKey(right)));
}

function directOwnerEntries(entries) {
  return entries.filter((entry) =>
    [
      VerificationAuthority.PRODUCT_SOURCE,
      VerificationAuthority.DETERMINISTIC_TEST,
      VerificationAuthority.GRAPH_BLIND_RUNTIME,
    ].includes(entry.authority),
  );
}

function buildOwnerTests(entries) {
  const targets = [];
  for (const entry of directOwnerEntries(entries)) {
    const system = entry.systems.find((candidate) => workspaceForSystem(candidate));
    const workspace = workspaceForSystem(system);
    if (!workspace) continue;
    const mode = entry.authority === VerificationAuthority.DETERMINISTIC_TEST ? 'files' : 'related';
    targets.push({ workspace, files: [entry.file], mode });
  }
  return mergeTargets(targets);
}

function buildConsumerTests(resolution, entries) {
  const directSystems = new Set(
    directOwnerEntries(entries).flatMap((entry) =>
      entry.systems.filter((system) => workspaceForSystem(system)),
    ),
  );
  if (directSystems.size === 0) return [];
  return mergeTargets(
    resolution.systems
      .filter((system) => !directSystems.has(system))
      .map(workspaceForSystem)
      .filter(Boolean)
      .map((workspace) => ({ workspace, files: [], mode: 'package' })),
  );
}

function buildTypechecks(resolution) {
  return uniqueSorted(
    resolution.verification
      .filter((command) => command.endsWith(':typecheck'))
      .map((command) => workspaceForSystem(command.slice(0, -':typecheck'.length)))
      .filter(Boolean),
  );
}

function buildBrowserPlan(resolution) {
  if (resolution.fullBrowserRequired) {
    return { mode: 'full', tags: [], fullBrowserRequired: true };
  }
  if (resolution.browserRequired) {
    return {
      mode: 'targeted',
      tags: uniqueSorted(resolution.browserTags),
      fullBrowserRequired: false,
    };
  }
  return { mode: 'none', tags: [], fullBrowserRequired: false };
}

/**
 * Build a deterministic execution plan from an authority-aware resolution.
 * The planner only selects work; command execution belongs to verify-affected.
 *
 * @param {import('./resolver.mjs').VerificationPlan} resolution
 * @param {string[]} changedFiles
 * @param {{ baseSha: string, headSha: string }} exactHead
 */
export function buildAffectedExecutionPlan(resolution, changedFiles, exactHead) {
  const entries = resolution?.entries ?? [];
  const normalizedFiles = uniqueSorted((changedFiles ?? []).map(String));
  return {
    ownerTests: buildOwnerTests(entries),
    consumerTests: buildConsumerTests(resolution, entries),
    typechecks: buildTypechecks(resolution),
    deploymentChecks: Boolean(resolution?.deploymentRequired),
    browser: buildBrowserPlan(resolution),
    exactHead: { baseSha: exactHead.baseSha, headSha: exactHead.headSha },
    changedFiles: normalizedFiles,
    reason: 'authority-aware affected verification',
  };
}
