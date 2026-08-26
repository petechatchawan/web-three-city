/**
 * VerificationRisk — PR-T2 risk classification.
 *
 * Ordered by severity low → high.
 * Higher risk always wins when merging plans (fail-safe escalation).
 */
export const VerificationRisk = Object.freeze({
  GRAPH_SAFE: 'GRAPH_SAFE',
  PARTIAL: 'PARTIAL',
  GRAPH_BLIND: 'GRAPH_BLIND',
  GLOBAL: 'GLOBAL',
});

const RANK = {
  [VerificationRisk.GRAPH_SAFE]: 0,
  [VerificationRisk.PARTIAL]: 1,
  [VerificationRisk.GRAPH_BLIND]: 2,
  [VerificationRisk.GLOBAL]: 3,
};

/**
 * Returns the higher of two risks (fail-safe: escalate, never de-escalate).
 */
export function maxRisk(a, b) {
  if (!(a in RANK) || !(b in RANK)) throw new Error(`unknown risk: ${a} / ${b}`);
  return RANK[a] >= RANK[b] ? a : b;
}

/**
 * Max across list, default GRAPH_SAFE for empty.
 */
export function maxRiskOf(risks) {
  if (risks.length === 0) return VerificationRisk.GRAPH_SAFE;
  return risks.reduce((acc, r) => maxRisk(acc, r));
}

export function isValidRisk(r) {
  return r in RANK;
}
