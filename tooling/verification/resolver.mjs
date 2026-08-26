/**
 * Impact Resolver — authority-aware verification planning.
 *
 * Changed files are classified by what they are allowed to prove first, then
 * expanded through the conservative ownership map. Test metadata is not a
 * shared browser infrastructure change, so it cannot request Full Browser by
 * itself.
 */

import { GLOBAL_OWNER, OWNERSHIP, normalizePath } from './ownership.mjs';
import { classifyChangedFile, VerificationAuthority } from './authority.mjs';
import { VerificationRisk, maxRiskOf } from './risk.mjs';

/**
 * @typedef {Object} VerificationPlan
 * @property {Array<Object>} entries
 * @property {string} authority
 * @property {string[]} systems
 * @property {string} risk
 * @property {string[]} verification
 * @property {boolean} browserRequired
 * @property {string[]} browserTags
 * @property {boolean} fullBrowserRequired
 * @property {boolean} deploymentRequired
 * @property {string} reason
 */

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareText);
}

function expandConsumers(systems) {
  const expanded = new Set(systems);
  for (const system of systems) {
    const owner = OWNERSHIP[system];
    if (!owner) continue;
    for (const consumer of owner.consumers) expanded.add(consumer);
  }
  return [...expanded].sort(compareText);
}

function collectVerification(systems) {
  const verification = new Set();
  for (const system of systems) {
    const owner = OWNERSHIP[system];
    if (!owner) continue;
    for (const command of owner.verification) verification.add(command);
  }
  return [...verification].sort(compareText);
}

function authorityFor(entries) {
  const authorities = uniqueSorted(entries.map((entry) => entry.authority));
  return authorities.length === 1 ? authorities[0] : 'MIXED';
}

function reasonFor(entries) {
  if (entries.length === 1) return entries[0].reason;
  return `merged authority-aware plan for ${entries.length} changed files`;
}

/**
 * Resolve changed files to a verification plan.
 * @param {string[]} changedFiles
 * @returns {VerificationPlan}
 */
export function resolveVerificationPlan(changedFiles) {
  const files = uniqueSorted(
    (changedFiles ?? [])
      .map((file) => String(file))
      .filter(Boolean)
      .map((file) => normalizePath(file)),
  );

  if (files.length === 0) {
    return {
      entries: [],
      authority: null,
      systems: [],
      risk: VerificationRisk.GRAPH_SAFE,
      verification: [],
      browserRequired: false,
      browserTags: [],
      fullBrowserRequired: false,
      deploymentRequired: false,
      reason: 'no changed files',
    };
  }

  const entries = files.map((file) => classifyChangedFile(file));
  const hasGlobal = entries.some(
    (entry) => entry.authority === VerificationAuthority.SHARED_VERIFICATION,
  );
  const directSystems = uniqueSorted(
    entries.flatMap((entry) => entry.systems).filter((system) => system !== 'GLOBAL'),
  );
  const systems = new Set(expandConsumers(directSystems));
  if (hasGlobal) systems.add('GLOBAL');
  if (
    systems.size === 0 &&
    entries.some((entry) => entry.authority === VerificationAuthority.GRAPH_BLIND_RUNTIME)
  ) {
    systems.add('unknown');
  }

  const verification = new Set([
    ...collectVerification(
      [...systems].filter((system) => system !== 'unknown' && system !== 'GLOBAL'),
    ),
    ...entries.flatMap((entry) => entry.verification),
  ]);
  if (hasGlobal) for (const command of GLOBAL_OWNER.verification) verification.add(command);
  if (verification.size === 0 && systems.has('unknown')) {
    verification.add('verify');
    verification.add('test:deployment');
  }

  const browserTags = uniqueSorted(entries.flatMap((entry) => entry.browserTags));
  if (hasGlobal) browserTags.push(...GLOBAL_OWNER.browserTags);

  return {
    entries,
    authority: authorityFor(entries),
    systems: [...systems].sort(compareText),
    risk: maxRiskOf(entries.map((entry) => entry.risk)),
    verification: uniqueSorted(verification),
    browserRequired: hasGlobal || entries.some((entry) => entry.browserRequired),
    browserTags: uniqueSorted(browserTags),
    fullBrowserRequired: hasGlobal || entries.some((entry) => entry.fullBrowserRequired),
    deploymentRequired: hasGlobal || entries.some((entry) => entry.deploymentRequired),
    reason: reasonFor(entries),
  };
}

/**
 * Legacy alias for the PR-T2 resolver contract. New authority/evidence fields
 * remain available through resolveVerificationPlan without changing callers
 * that consume the original minimal shape.
 */
export function resolve(changedFiles) {
  const plan = resolveVerificationPlan(changedFiles);
  return {
    systems: plan.systems,
    risk: plan.risk,
    verification: plan.verification,
    browserRequired: plan.browserRequired,
  };
}
