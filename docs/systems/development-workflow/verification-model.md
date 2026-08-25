# Verification Infrastructure — PR-T2 Foundation

**Status:** Implemented — PR-T2 Verification Infrastructure Foundation  
**Relation:** builds on PR-T1 (Formal Test Architecture Audit)  
**System:** Development Workflow

## Purpose

PR-T2 does **not** migrate or change any Playwright tests, CI behavior, workers, retries, or browser configuration. It establishes a deterministic answer to one question:

> From these changed files, what verification must run?

The output is a **verification plan** with a bounded, fail-safe escalation behavior. This is the foundation for PR-T3 (Browser Classification / Migration).

## Architecture

```text
Changed Files
      |
      v
Impact Resolver      tooling/verification/resolver.mjs
      |
      v
Affected Systems     tooling/verification/ownership.mjs (source of truth)
      |
      v
Risk Classification tooling/verification/risk.mjs
      |
      v
Verification Plan   systems + risk + verification + browserRequired
```

Entry point: `pnpm verify:impact <changed files...>` (`tooling/verify-impact.mjs`).

## Risk Classification

| Risk | Meaning | Examples |
|---|---|---|
| `GRAPH_SAFE` | Dependency clear; related tests trustworthy. | pure utility, isolated domain logic |
| `PARTIAL` | Multiple consumers; requires static expansion. | package API, shared domain module |
| `GRAPH_BLIND` | Import graph insufficient. | runtime registry, event bus, dynamic lookup, string identifiers, runtime composition |
| `GLOBAL` | Change is wide-reaching. | package.json, lockfile, vite config, build config, persistence schema, bootstrap |

Risk is ordered low → high. When merging multiple changes, the **highest** risk wins.

## Ownership Model (source of truth)

`tooling/verification/ownership.mjs` is the canonical ownership map. Every owner declares:

- `system` — canonical package name;
- `risk` — `VerificationRisk` for a direct change;
- `verification` — affected package verification targets;
- `browserTags` — Playwright ownership tags required when directly changed;
- `consumers` — static Level-2 expansion consumers (extra verification is safe).

Audit-required packages added by PR-T2:

- `citizen-mobility-core` (PARTIAL, consumers `traffic-core`, `game`)
- `traffic-core` (PARTIAL, consumers `traffic-three`, `game`)
- `traffic-three` (GRAPH_SAFE, browser tag `@traffic`)

Note: `browserRequired` is driven by the **direct changed owner**, not by expanded
consumers. A pure-domain change (e.g. `traffic-core`) does not force browser
verification merely because a presentation consumer (`traffic-three`) owns browser specs.
Browser requirement for `traffic-core` is satisfied by `traffic-core:test` + the
expanded `traffic-three:test` (Vitest), not by the `@traffic` browser suite.

## Global Escalation Rules (fail-safe)

```text
Unknown  ──────────────►  GRAPH_BLIND
High risk / global file ─► GLOBAL
Safety > optimization
```

- Unknown file ownership → escalate to `GRAPH_BLIND` (never under-verify).
- GLOBAL-pattern file (config, lockfile, persistence schema, bootstrap, CI) → `GLOBAL` with `verify` + `verify:full` and `browserRequired: true`.
- `GRAPH_BLIND` always sets `browserRequired: true`.

## CLI Preview

```bash
pnpm verify:impact packages/traffic-core/src/Road.ts
```

Output:

```text
Affected Systems:
  - traffic-core
  - traffic-three
  - game

Risk: PARTIAL
Reason: matched owners: traffic-core

Recommended Verification:
  - traffic-core:test
  - traffic-core:typecheck
  - traffic-three:test
  - traffic-three:typecheck
  - game:test
  - game:typecheck

Browser Required: NO
```

JSON variant: `pnpm verify:impact --json <files...>`.

## Tests

- `tooling/verification/verification-resolver.test.mjs` — resolver behavior (TDD RED first).
- `tooling/verification-resolver.test.mjs` — rover-level contract incl. audit packages + CLI.
- Both run inside `pnpm test:deployment`.

## Safety Invariants

PR-T2 preserves all existing authority:

- No production behavior changed.
- No gameplay/runtime logic changed.
- No Playwright tests migrated, removed, or reduced.
- CI gate execution, workers, retries, and browser configuration unchanged.
- `pnpm verify`, `pnpm verify:full`, Lean CI artifact flow, deterministic browser
  verification, clean-worktree evidence, and release-gate discipline unchanged.

## Non-Goals (PR-T2)

- Migrate Playwright tests.
- Remove or reduce browser coverage.
- Change CI gate execution or browser infrastructure.
- Replace the static Level 2 map (that remains the conservative authority; this
  ownership model is complementary input for PR-T3).

## Next

PR-T3 will use this foundation for Browser Classification / Migration, turning
`browserRequired` + `browserTags` into precise targeted Playwright tag selection.
