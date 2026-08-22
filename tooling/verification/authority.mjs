/**
 * Changed-file authority classification for verification planning.
 *
 * Authority describes what the file is allowed to prove. Risk describes how
 * conservative the resulting verification must be. Keeping those dimensions
 * separate prevents test metadata from accidentally requesting Full Browser.
 */

import {
  GRAPH_BLIND_PATTERNS,
  GLOBAL_PATTERNS,
  OWNERSHIP,
  normalizePath,
  ownerForFile,
} from './ownership.mjs';
import { VerificationRisk } from './risk.mjs';

export const VerificationAuthority = Object.freeze({
  PRODUCT_SOURCE: 'PRODUCT_SOURCE',
  DETERMINISTIC_TEST: 'DETERMINISTIC_TEST',
  BROWSER_CONTRACT: 'BROWSER_CONTRACT',
  TEST_TOPOLOGY: 'TEST_TOPOLOGY',
  SHARED_VERIFICATION: 'SHARED_VERIFICATION',
  GRAPH_BLIND_RUNTIME: 'GRAPH_BLIND_RUNTIME',
});

const BROWSER_TAG_SYSTEMS = Object.freeze({
  '@building': 'building-three',
  '@interaction': 'game',
  '@rci': 'rci-core',
  '@road': 'road-three',
  '@smoke': 'game',
  '@terrain': 'terrain-three',
  '@traffic': 'traffic-three',
  '@water': 'water-three',
  '@zoning': 'zone-three',
});

function sorted(values) {
  return [...new Set(values)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function extractBrowserTags(file) {
  const tags = normalizePath(file).match(/@[a-z0-9-]+/gi) ?? [];
  return sorted(tags.map((tag) => tag.toLowerCase()).filter((tag) => Object.hasOwn(BROWSER_TAG_SYSTEMS, tag)));
}

function browserSystems(tags) {
  return sorted(tags.flatMap((tag) => (BROWSER_TAG_SYSTEMS[tag] ? [BROWSER_TAG_SYSTEMS[tag]] : [])));
}

function isBrowserSpec(file) {
  return normalizePath(file).startsWith('browser-tests/') && /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(normalizePath(file));
}

function isTopologyFile(file) {
  const normalized = normalizePath(file);
  return /^tooling\/(?:test-topology|ci-topology)\.test\.[cm]?js$/.test(normalized);
}

function isDeterministicTest(file) {
  const normalized = normalizePath(file);
  return /(?:^|\/)(?:test|tests)\//.test(normalized) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalized);
}

function isSharedVerificationFile(file) {
  const normalized = normalizePath(file);
  return GLOBAL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isGraphBlindRuntime(file) {
  const normalized = normalizePath(file);
  return GRAPH_BLIND_PATTERNS.some((pattern) => pattern.test(normalized));
}

function ownerClassification(file, authority) {
  const system = ownerForFile(file);
  const owner = system ? OWNERSHIP[system] : undefined;
  return {
    systems: system ? [system] : [],
    risk: owner?.risk ?? VerificationRisk.GRAPH_BLIND,
    verification: owner?.verification ?? [],
    browserTags: authority === VerificationAuthority.PRODUCT_SOURCE ? owner?.browserTags ?? [] : [],
  };
}

/**
 * Classify one changed file into its verification authority.
 * @param {string} file
 */
export function classifyChangedFile(file) {
  const normalized = normalizePath(String(file));

  if (isTopologyFile(normalized)) {
    return {
      file: normalized,
      authority: VerificationAuthority.TEST_TOPOLOGY,
      systems: [],
      risk: VerificationRisk.PARTIAL,
      verification: ['test:deployment'],
      browserTags: [],
      browserRequired: false,
      fullBrowserRequired: false,
      deploymentRequired: true,
      reason: 'test inventory/topology authority requires exact deployment checks',
    };
  }

  if (isBrowserSpec(normalized)) {
    const browserTags = extractBrowserTags(normalized);
    const systems = browserSystems(browserTags);
    return {
      file: normalized,
      authority: VerificationAuthority.BROWSER_CONTRACT,
      systems,
      risk: VerificationRisk.GRAPH_SAFE,
      verification: [],
      browserTags,
      browserRequired: true,
      fullBrowserRequired: false,
      deploymentRequired: false,
      reason: browserTags.length > 0 ? 'approved browser ownership tags select targeted evidence' : 'browser contract requires browser evidence',
    };
  }

  if (isSharedVerificationFile(normalized)) {
    return {
      file: normalized,
      authority: VerificationAuthority.SHARED_VERIFICATION,
      systems: ['GLOBAL'],
      risk: VerificationRisk.GLOBAL,
      verification: [],
      browserTags: [],
      browserRequired: true,
      fullBrowserRequired: true,
      deploymentRequired: true,
      reason: 'shared verification/configuration authority changes how the repository executes',
    };
  }

  if (isGraphBlindRuntime(normalized)) {
    const owner = ownerClassification(normalized, VerificationAuthority.GRAPH_BLIND_RUNTIME);
    return {
      file: normalized,
      authority: VerificationAuthority.GRAPH_BLIND_RUNTIME,
      systems: owner.systems,
      risk: VerificationRisk.GRAPH_BLIND,
      verification: owner.verification,
      browserTags: owner.browserTags,
      browserRequired: true,
      fullBrowserRequired: false,
      deploymentRequired: false,
      reason: 'dynamic runtime composition cannot be bounded by the static ownership graph',
    };
  }

  if (isDeterministicTest(normalized)) {
    const owner = ownerClassification(normalized, VerificationAuthority.DETERMINISTIC_TEST);
    return {
      file: normalized,
      authority: VerificationAuthority.DETERMINISTIC_TEST,
      systems: owner.systems,
      risk: owner.systems.length > 0 ? VerificationRisk.GRAPH_SAFE : VerificationRisk.GRAPH_BLIND,
      verification: owner.verification,
      browserTags: [],
      browserRequired: false,
      fullBrowserRequired: false,
      deploymentRequired: false,
      reason: owner.systems.length > 0 ? 'deterministic test authority is below the browser' : 'deterministic test has no known owner',
    };
  }

  const owner = ownerClassification(normalized, VerificationAuthority.PRODUCT_SOURCE);
  if (owner.systems.length > 0) {
    return {
      file: normalized,
      authority: VerificationAuthority.PRODUCT_SOURCE,
      ...owner,
      browserRequired: owner.browserTags.length > 0,
      fullBrowserRequired: false,
      deploymentRequired: false,
      reason: `owned production source: ${owner.systems.join(', ')}`,
    };
  }

  return {
    file: normalized,
    authority: VerificationAuthority.GRAPH_BLIND_RUNTIME,
    systems: [],
    risk: VerificationRisk.GRAPH_BLIND,
    verification: ['verify', 'test:deployment'],
    browserTags: [],
    browserRequired: true,
    fullBrowserRequired: false,
    deploymentRequired: true,
    reason: `unknown ownership for: ${normalized}`,
  };
}

export { BROWSER_TAG_SYSTEMS, extractBrowserTags };
