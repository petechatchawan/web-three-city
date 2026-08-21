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

/** @type {Record<string, Owner>} */
export const OWNERSHIP = Object.freeze({
  'world-core': {
    system: 'world-core',
    pathPrefix: 'packages/world-core/',
    risk: VerificationRisk.PARTIAL,
    verification: ['world-core:test', 'world-core:typecheck'],
    browserTags: [],
    consumers: [
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
    ],
  },
  'terrain-core': {
    system: 'terrain-core',
    pathPrefix: 'packages/terrain-core/',
    risk: VerificationRisk.PARTIAL,
    verification: ['terrain-core:test', 'terrain-core:typecheck'],
    browserTags: ['@terrain'],
    consumers: ['road-core', 'water-core', 'zone-core', 'building-core', 'road-three', 'terrain-three', 'game', 'terrain-lab'],
  },
  'terrain-generator': {
    system: 'terrain-generator',
    pathPrefix: 'packages/terrain-generator/',
    risk: VerificationRisk.PARTIAL,
    verification: ['terrain-generator:test', 'terrain-generator:typecheck'],
    browserTags: [],
    consumers: ['game', 'terrain-lab'],
  },
  'terrain-three': {
    system: 'terrain-three',
    pathPrefix: 'packages/terrain-three/',
    risk: VerificationRisk.GRAPH_SAFE,
    verification: ['terrain-three:test', 'terrain-three:typecheck'],
    browserTags: ['@terrain'],
    consumers: ['game', 'terrain-lab'],
  },
  'road-core': {
    system: 'road-core',
    pathPrefix: 'packages/road-core/',
    risk: VerificationRisk.PARTIAL,
    verification: ['road-core:test', 'road-core:typecheck'],
    browserTags: ['@road'],
    consumers: ['road-three', 'game', 'terrain-lab'],
  },
  'road-three': {
    system: 'road-three',
    pathPrefix: 'packages/road-three/',
    risk: VerificationRisk.GRAPH_SAFE,
    verification: ['road-three:test', 'road-three:typecheck'],
    browserTags: ['@road'],
    consumers: ['game', 'terrain-lab'],
  },
  'water-core': {
    system: 'water-core',
    pathPrefix: 'packages/water-core/',
    risk: VerificationRisk.PARTIAL,
    verification: ['water-core:test', 'water-core:typecheck'],
    browserTags: ['@water'],
    consumers: ['water-three', 'game', 'terrain-lab'],
  },
  'water-three': {
    system: 'water-three',
    pathPrefix: 'packages/water-three/',
    risk: VerificationRisk.GRAPH_SAFE,
    verification: ['water-three:test', 'water-three:typecheck'],
    browserTags: ['@water'],
    consumers: ['game', 'terrain-lab'],
  },
  'zone-core': {
    system: 'zone-core',
    pathPrefix: 'packages/zone-core/',
    risk: VerificationRisk.PARTIAL,
    verification: ['zone-core:test', 'zone-core:typecheck'],
    browserTags: ['@zoning'],
    consumers: ['building-core', 'rci-core', 'zone-three', 'game'],
  },
  'zone-three': {
    system: 'zone-three',
    pathPrefix: 'packages/zone-three/',
    risk: VerificationRisk.GRAPH_SAFE,
    verification: ['zone-three:test', 'zone-three:typecheck'],
    browserTags: ['@zoning'],
    consumers: ['game'],
  },
  'building-core': {
    system: 'building-core',
    pathPrefix: 'packages/building-core/',
    risk: VerificationRisk.PARTIAL,
    verification: ['building-core:test', 'building-core:typecheck'],
    browserTags: ['@building'],
    consumers: ['rci-core', 'building-three', 'game'],
  },
  'building-three': {
    system: 'building-three',
    pathPrefix: 'packages/building-three/',
    risk: VerificationRisk.GRAPH_SAFE,
    verification: ['building-three:test', 'building-three:typecheck'],
    browserTags: ['@building'],
    consumers: ['game'],
  },
  'simulation-core': {
    system: 'simulation-core',
    pathPrefix: 'packages/simulation-core/',
    risk: VerificationRisk.PARTIAL,
    verification: ['simulation-core:test', 'simulation-core:typecheck'],
    browserTags: [],
    consumers: ['building-core', 'rci-core', 'game'],
  },
  'rci-core': {
    system: 'rci-core',
    pathPrefix: 'packages/rci-core/',
    risk: VerificationRisk.PARTIAL,
    verification: ['rci-core:test', 'rci-core:typecheck'],
    browserTags: ['@rci'],
    consumers: ['game'],
  },
  'economy-core': {
    system: 'economy-core',
    pathPrefix: 'packages/economy-core/',
    risk: VerificationRisk.PARTIAL,
    verification: ['economy-core:test', 'economy-core:typecheck'],
    browserTags: [],
    consumers: ['game'],
  },
  'citizen-mobility-core': {
    system: 'citizen-mobility-core',
    pathPrefix: 'packages/citizen-mobility-core/',
    risk: VerificationRisk.PARTIAL,
    verification: ['citizen-mobility-core:test', 'citizen-mobility-core:typecheck'],
    browserTags: [],
    consumers: ['traffic-core', 'game'],
  },
  'traffic-core': {
    system: 'traffic-core',
    pathPrefix: 'packages/traffic-core/',
    risk: VerificationRisk.PARTIAL,
    verification: ['traffic-core:test', 'traffic-core:typecheck'],
    browserTags: [],
    consumers: ['traffic-three', 'game'],
  },
  'traffic-three': {
    system: 'traffic-three',
    pathPrefix: 'packages/traffic-three/',
    risk: VerificationRisk.GRAPH_SAFE,
    verification: ['traffic-three:test', 'traffic-three:typecheck'],
    browserTags: ['@traffic'],
    consumers: ['game'],
  },
  'camera-input': {
    system: 'camera-input',
    pathPrefix: 'packages/camera-input/',
    risk: VerificationRisk.GRAPH_SAFE,
    verification: ['camera-input:test', 'camera-input:typecheck'],
    browserTags: ['@interaction'],
    consumers: ['game', 'terrain-lab'],
  },
  'shared-testkit': {
    system: 'shared-testkit',
    pathPrefix: 'packages/shared-testkit/',
    risk: VerificationRisk.GRAPH_SAFE,
    verification: ['shared-testkit:typecheck'],
    browserTags: [],
    consumers: [],
  },
  game: {
    system: 'game',
    pathPrefix: 'apps/game/',
    risk: VerificationRisk.GRAPH_BLIND,
    verification: ['game:test', 'game:typecheck'],
    browserTags: ['@traffic', '@road', '@building', '@rci', '@interaction'],
    consumers: [],
  },
  'terrain-lab': {
    system: 'terrain-lab',
    pathPrefix: 'apps/terrain-lab/',
    risk: VerificationRisk.GRAPH_SAFE,
    verification: ['terrain-lab:build'],
    browserTags: ['@terrain'],
    consumers: [],
  },
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
 * Patterns that force GLOBAL escalation (fail-safe: safety > optimization).
 * Matches against the changed file path.
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
  /^tooling\//,
  /^browser-tests\//,
  // persistence / save schema / bootstrap are GLOBAL per spec
  /persistence/i,
  /WorldSave/i,
  /Save.*V\d+/,
  /bootstrap/i,
  /game-bootstrap/i,
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
]);

export function normalizePath(file) {
  return file.replaceAll('\\', '/');
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
