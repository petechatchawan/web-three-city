/**
 * Verification Ownership Model — single source of truth for PR-T2.
 *
 * Each owner declares:
 * - system: canonical package/system name
 * - risk: VerificationRisk class for direct changes
 * - verification: affected verification targets (pnpm scripts / tags)
 * - browserTags: Playwright ownership tags required when this system is touched
 * - consumers: static Level-2 expanded consumers (extra verification is safe)
 *
 * Audit-required packages are included:
 * - citizen-mobility-core
 * - traffic-core
 * - traffic-three
 */

import { VerificationRisk } from './risk.mjs';

/**
 * @typedef {Object} Owner
 * @property {string} system
 * @property {string} risk
 * @property {string[]} verification
 * @property {string[]} browserTags
 * @property {string[]} consumers
 * @property {string} pathPrefix  file prefix that maps to this owner
 */

function createOwner(system, risk, browserTags, consumers, options = {}) {
  const {
    pathPrefix = `packages/${system}/`,
    verification = [`${system}:test`, `${system}:typecheck`],
  } = options;
  return { system, pathPrefix, risk, verification, browserTags, consumers };
}

/** @type {Record<string, Owner>} */
export const OWNERSHIP = Object.freeze({
  'world-core': createOwner('world-core', VerificationRisk.PARTIAL, [], [
    'terrain-core',
    'road-core',
    'water-core',
    'zone-core',
    'building-core',
    'rci-core',
    'building-three',
    'road-three',
    'terrain-three',
    'water-three',
    'zone-three',
    'game',
    'terrain-lab',
  ]),
  'terrain-core': createOwner('terrain-core', VerificationRisk.PARTIAL, ['@terrain'], [
    'road-core',
    'water-core',
    'zone-core',
    'building-core',
    'road-three',
    'terrain-three',
    'game',
    'terrain-lab',
  ]),
  'terrain-generator': createOwner('terrain-generator', VerificationRisk.PARTIAL, [], ['game', 'terrain-lab']),
  'terrain-three': createOwner('terrain-three', VerificationRisk.GRAPH_SAFE, ['@terrain'], ['game', 'terrain-lab']),
  'road-core': createOwner('road-core', VerificationRisk.PARTIAL, ['@road'], ['road-three', 'game', 'terrain-lab']),
  'road-three': createOwner('road-three', VerificationRisk.GRAPH_SAFE, ['@road'], ['game', 'terrain-lab']),
  'water-core': createOwner('water-core', VerificationRisk.PARTIAL, ['@water'], ['water-three', 'game', 'terrain-lab']),
  'water-three': createOwner('water-three', VerificationRisk.GRAPH_SAFE, ['@water'], ['game', 'terrain-lab']),
  'zone-core': createOwner('zone-core', VerificationRisk.PARTIAL, ['@zoning'], ['building-core', 'rci-core', 'zone-three', 'game']),
  'zone-three': createOwner('zone-three', VerificationRisk.GRAPH_SAFE, ['@zoning'], ['game']),
  'building-core': createOwner('building-core', VerificationRisk.PARTIAL, ['@building'], ['rci-core', 'building-three', 'game']),
  'building-three': createOwner('building-three', VerificationRisk.GRAPH_SAFE, ['@building'], ['game']),
  'simulation-core': createOwner('simulation-core', VerificationRisk.PARTIAL, [], ['building-core', 'rci-core', 'game']),
  'rci-core': createOwner('rci-core', VerificationRisk.PARTIAL, ['@rci'], ['game']),
  'economy-core': createOwner('economy-core', VerificationRisk.PARTIAL, [], ['game']),
  'citizen-mobility-core': createOwner('citizen-mobility-core', VerificationRisk.PARTIAL, [], ['traffic-core', 'game']),
  'traffic-core': createOwner('traffic-core', VerificationRisk.PARTIAL, [], ['traffic-three', 'game']),
  'traffic-three': createOwner('traffic-three', VerificationRisk.GRAPH_SAFE, ['@traffic'], ['game']),
  'camera-input': createOwner('camera-input', VerificationRisk.GRAPH_SAFE, ['@interaction'], ['game', 'terrain-lab']),
  'shared-testkit': createOwner('shared-testkit', VerificationRisk.GRAPH_SAFE, [], [], {
    verification: ['shared-testkit:typecheck'],
  }),
  game: createOwner('game', VerificationRisk.GRAPH_BLIND, ['@traffic', '@road', '@building', '@rci', '@interaction'], [], {
    pathPrefix: 'apps/game/',
  }),
  'terrain-lab': createOwner('terrain-lab', VerificationRisk.GRAPH_SAFE, ['@terrain'], [], {
    pathPrefix: 'apps/terrain-lab/',
    verification: ['terrain-lab:build'],
  }),
});

/**
 * GLOBAL ownership — not a package prefix but file-pattern owned.
 * When matched, escalates to GLOBAL with repository-wide verification.
 */
export const GLOBAL_OWNER = Object.freeze({
  system: 'GLOBAL',
  pathPrefix: '<global>',
  risk: VerificationRisk.GLOBAL,
  verification: ['verify', 'verify:full', 'test:deployment', 'typecheck', 'build'],
  browserTags: ['@smoke', '@release'],
  consumers: [],
});

/**
 * Shared verification/configuration patterns that force GLOBAL escalation.
 * Test authority has explicit rules in authority.mjs and must not be swept
 * into this list merely because it lives under tooling/ or browser-tests/.
 */
export const GLOBAL_PATTERNS = Object.freeze([
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^\.npmrc$/,
  /^tsconfig.*\.json$/,
  /^vite\.config\./,
  /^vitest\.config\./,
  /^playwright\.config\./,
  /^eslint\.config\./,
  /^\.github\//,
  /^tooling\/verification(?:\/|-)/,
  /^tooling\/verify-(?:impact|affected)\./,
  /^tooling\/ci-topology\.test\./,
  /^tooling\/verification-scripts\.test\./,
  /^tooling\/(?:architecture-boundary|development-workflow|compose-vercel-output|bootstrap-vercel-project|verify-clean-worktree|check-provenance)\./,
  // build infra
  /vercel\.json$/,
  /Dockerfile/,
]);

/**
 * Patterns that force GRAPH_BLIND escalation.
 * Runtime registry / event bus / dynamic lookup / string identifiers / composition.
 */
export const GRAPH_BLIND_PATTERNS = Object.freeze([
  /registry/i,
  /event[-_]?bus/i,
  /dynamic/i,
  /lookup/i,
  /composition/i,
  /apps\/game\/src\/game-bootstrap/,
  /bootstrap/i,
]);

/**
 * `apps/game` is a composition boundary, not one Browser owner. These rules
 * narrow bounded presentation paths before the generic game owner is used.
 * Deterministic test files are classified by authority before these rules are
 * consulted, so test metadata cannot inherit production Browser tags.
 */
const GAME_SOURCE_RULES = Object.freeze([
  {
    pattern: /^apps\/game\/src\/(?:traffic-presentation|traffic-runtime-presentation|traffic-presentation-projection|traffic-information-view|traffic-inspect-target)\.ts$/,
    browserTags: ['@traffic'],
    browserRequired: true,
    fullBrowserRequired: false,
  },
  {
    pattern: /^apps\/game\/src\/ui\/inspect\/traffic-inspect-projections\.ts$/,
    browserTags: ['@traffic'],
    browserRequired: true,
    fullBrowserRequired: false,
  },
  {
    pattern: /^apps\/game\/src\/terraform-water-projection\.ts$/,
    browserTags: ['@water'],
    browserRequired: true,
    fullBrowserRequired: false,
  },
  {
    pattern: /^apps\/game\/src\/zone-building-presentation\.ts$/,
    browserTags: ['@building', '@zoning'],
    browserRequired: true,
    fullBrowserRequired: false,
  },
  {
    pattern: /^apps\/game\/src\/(?:traffic-transport-transaction|traffic-source-projection|traffic-road-reconciliation|traffic-graph-cache|mobility-traffic-tick|mobility-traffic-state-registry|rci-building-reconciliation|economy-tax-policy-command|traffic-release-fixture|traffic-performance-release-fixture)\.ts$/,
    browserTags: [],
    browserRequired: false,
    fullBrowserRequired: false,
  },
  {
    pattern: /^apps\/game\/src\/(?:game-bootstrap|main)\.ts$/,
    browserTags: [],
    browserRequired: true,
    fullBrowserRequired: true,
  },
]);

export function normalizePath(file) {
  return file.replaceAll('\\', '/');
}

/**
 * Returns a bounded `apps/game` source rule, when one is declared.
 */
export function gameSourceRuleForFile(file) {
  const normalized = normalizePath(file);
  return GAME_SOURCE_RULES.find(({ pattern }) => pattern.test(normalized)) ?? null;
}

/**
 * Returns owner key for a file path, or null if no direct owner.
 */
export function ownerForFile(file) {
  const normalized = normalizePath(file);
  for (const owner of Object.values(OWNERSHIP)) {
    if (normalized.startsWith(owner.pathPrefix)) return owner.system;
  }
  return null;
}

export function allSystems() {
  return Object.keys(OWNERSHIP);
}
