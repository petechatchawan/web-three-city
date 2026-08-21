/**
 * Impact Resolver — PR-T2 Verification Infrastructure Foundation
 *
 * Changed Files → Affected Systems → Risk → Verification Plan
 *
 * Fail-safe: unknown → GRAPH_BLIND, high risk → GLOBAL, safety > optimization.
 *
 * No production behavior is changed; this is pure verification planning.
 */

import { GLOBAL_OWNER, GLOBAL_PATTERNS, GRAPH_BLIND_PATTERNS, normalizePath, OWNERSHIP } from './ownership.mjs';
import { VerificationRisk, maxRiskOf } from './risk.mjs';

/**
 * @typedef {Object} VerificationPlan
 * @property {string[]} systems
 * @property {string} risk
 * @property {string[]} verification
 * @property {boolean} browserRequired
 * @property {string[]} browserTags
 * @property {string} reason
 */

function isGlobalFile(file) {
  const n = normalizePath(file);
  return GLOBAL_PATTERNS.some((re) => re.test(n));
}

function isGraphBlindFile(file) {
  const n = normalizePath(file);
  return GRAPH_BLIND_PATTERNS.some((re) => re.test(n));
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function resolveOwnerSystems(files) {
  const direct = new Set();
  for (const f of files) {
    const n = normalizePath(f);
    const match = Object.values(OWNERSHIP).find((o) => n.startsWith(o.pathPrefix));
    if (match) direct.add(match.system);
  }
  return [...direct];
}

function expandConsumers(systems) {
  const expanded = new Set(systems);
  for (const s of systems) {
    const owner = OWNERSHIP[s];
    if (!owner) continue;
    for (const c of owner.consumers) expanded.add(c);
  }
  return [...expanded].sort(compareText);
}

function collectVerification(systems) {
  const out = new Set();
  for (const s of systems) {
    const owner = OWNERSHIP[s];
    if (owner) for (const v of owner.verification) out.add(v);
  }
  return [...out].sort(compareText);
}

function collectBrowserTags(systems) {
  const tags = new Set();
  for (const s of systems) {
    const owner = OWNERSHIP[s];
    if (owner) for (const t of owner.browserTags) tags.add(t);
  }
  return [...tags].sort(compareText);
}

/**
 * Resolve changed files to a verification plan.
 * @param {string[]} changedFiles
 * @returns {VerificationPlan}
 */
export function resolveVerificationPlan(changedFiles) {
  const files = (changedFiles ?? []).map(String).filter(Boolean);

  if (files.length === 0) {
    return {
      systems: [],
      risk: VerificationRisk.GRAPH_SAFE,
      verification: [],
      browserRequired: false,
      browserTags: [],
      reason: 'no changed files',
    };
  }

  // GLOBAL escalation: any global-pattern file → GLOBAL
  const hasGlobal = files.some(isGlobalFile);
  if (hasGlobal) {
    const direct = resolveOwnerSystems(files);
    // expand consumers of direct owners as well
    const expanded = new Set(expandConsumers([...direct]));
    expanded.add('GLOBAL');
    const systems = [...expanded].sort(compareText);
    // verification is GLOBAL + direct verification
    const verification = [...new Set([...GLOBAL_OWNER.verification, ...collectVerification([...direct])])].sort(compareText);
    const browserTags = [...new Set([...GLOBAL_OWNER.browserTags, ...collectBrowserTags([...direct])])].sort(compareText);
    return {
      systems,
      risk: VerificationRisk.GLOBAL,
      verification,
      browserRequired: true,
      browserTags,
      reason: 'GLOBAL pattern matched — full verification required',
    };
  }

  // GRAPH_BLIND escalation: unknown files or blind-pattern files
  const hasBlind = files.some(isGraphBlindFile);
  const unknownFiles = files.filter((f) => {
    const n = normalizePath(f);
    if (isGraphBlindFile(f)) return false;
    // known if matches any ownership prefix or global pattern
    const knownOwner = Object.values(OWNERSHIP).some((o) => n.startsWith(o.pathPrefix));
    const knownGlobal = GLOBAL_PATTERNS.some((re) => re.test(n));
    return !knownOwner && !knownGlobal;
  });
  const hasUnknown = unknownFiles.length > 0;

  if (hasBlind || hasUnknown) {
    const direct = resolveOwnerSystems(files);
    const expanded = expandConsumers(direct);
    // include unknown owner systems as-is plus expansion
    const systems = [...new Set([...direct, ...expanded])].sort(compareText);
    // if completely unknown, include generic graph-blind verification
    const baseVerification = systems.length > 0 ? collectVerification(systems) : [];
    const verification =
      baseVerification.length > 0
        ? [...new Set([...baseVerification, 'verify'] )].sort(compareText)
        : ['verify', 'test:deployment'];
    const browserTags = collectBrowserTags(systems);
    // GRAPH_BLIND always requires browser consideration
    return {
      systems: systems.length > 0 ? systems : ['unknown'],
      risk: VerificationRisk.GRAPH_BLIND,
      verification,
      browserRequired: true,
      browserTags,
      reason: hasBlind
        ? 'GRAPH_BLIND pattern matched (registry/event-bus/composition)'
        : `unknown ownership for: ${unknownFiles.join(', ')}`,
    };
  }

  // Normal: map files to owners, expand consumers, compute max risk.
  // Browser requirement is driven by the DIRECT changed owner(s), not expanded
  // consumers: a pure-domain change does not force browser verification merely
  // because a presentation consumer also has browser specs.
  const direct = resolveOwnerSystems(files);
  const systems = expandConsumers(direct);
  const risks = direct.map((s) => OWNERSHIP[s]?.risk ?? VerificationRisk.GRAPH_SAFE);
  const risk = maxRiskOf(risks);
  const verification = collectVerification(systems);
  const browserTags = collectBrowserTags(direct);
  const browserRequired = browserTags.length > 0;

  return {
    systems,
    risk,
    verification,
    browserRequired,
    browserTags,
    reason: `matched owners: ${direct.join(', ')}`,
  };
}

/**
 * Legacy alias for spec example shape.
 * Returns minimal shape expected by PR-T2 spec tests.
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
