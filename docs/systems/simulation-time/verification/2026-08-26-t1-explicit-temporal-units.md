# T1 Explicit Temporal Units + Architecture Enforcement — Verification

**Status:** Local GREEN; exact-head CI/Sonar pending non-force push
**System:** `simulation-time`
**Branch:** `feat/temporal-explicit-units-v1`
**Implementation base:** `10a6c1f8c593451262d077779787fc5c127858e1`
**Source-tested SHA:** `62a6b6e470a239df686d052f9905969c3f98a41c`

## Scope

T1 introduces explicit validated point/duration scalar types in
`simulation-core`, types the existing Simulation temporal authority and
macro-hour projection, and adds AST-based architecture enforcement. It does
not change calendar mapping, playback pacing, domain temporal semantics,
WorldSaveV8 wire output, Growth policy, or the five-phase transaction.

## TDD evidence

- Task 1 RED: `pnpm --filter @web-three-city/simulation-core exec vitest run test/temporal-units.test.ts` failed for the intended missing temporal API (`8` tests, `3` initially failed; invalid-input assertions were tightened to require `RangeError` before implementation).
- Task 1 GREEN: the same focused suite passed `8/8`; simulation-core typecheck and `git diff --check` passed.
- Task 2 RED: simulation-core typecheck failed for the intended raw-number/typed-contract boundary before migration.
- Task 2 GREEN: simulation-core suite passed `24` tests across `6` files and typecheck passed.
- Task 3 RED: `node --test tooling/temporal-unit-boundary.test.mjs` failed the operator/cast fixture assertions while the scanner was stubbed.
- Task 3 GREEN: temporal boundary tests passed `4/4`; architecture boundary plus temporal tests passed `12/12`; deployment verification passed `106/106`.
- Task 4 RED: Game typecheck failed because temporal publication results were still typed as numbers.
- Task 4 GREEN: focused Game temporal suite passed `20/20`; Game typecheck and root typecheck passed.

## Selective Verification

The authoritative resolver was run against the immutable base and the exact
candidate head:

```text
pnpm verify:affected -- --base 10a6c1f8c593451262d077779787fc5c127858e1 --head HEAD --plan-only --json
pnpm verify:affected -- --base 10a6c1f8c593451262d077779787fc5c127858e1 --head HEAD --skip-browser
```

The final plan classified `package.json` and the architecture fixtures as
shared/global verification authority, selected deployment checks, and
escalated to Full Browser. The non-browser affected execution passed. The
resolver-selected scope included GLOBAL, `simulation-core`, `building-core`,
`rci-core`, and `game` ownership/consumer verification.

## Verification results

- `simulation-core`: `6` files, `24` tests passed.
- Game: `98` files, `407` tests passed in the full workspace run.
- Full workspace `pnpm test`: all workspace suites passed, including
  `simulation-core`, `building-core`, `rci-core`, and Game.
- `pnpm test:deployment`: `106/106` passed.
- `pnpm check`: passed, including format, lint, workspace/browser typecheck,
  provenance, deployment, all workspace tests, and builds.
- `git diff --check`: passed.
- Full Browser: `149/150` passed, `1` skipped, `0` failed. The skipped case is
  `browser-tests/citizen-mobility-traffic-performance.@traffic@release.spec.ts`
  and is gated to the Metal performance authority; this local run used the
  default SwiftShader environment.
- `pnpm verify:full` returned non-zero only at its final clean-worktree check,
  which correctly reported the two pre-existing protected untracked plan
  files listed below. No tracked worktree changes were left by verification.

## Preserved semantics

- Legacy calendar remains `24h/day`, `30 days/month`, `12 months/year`.
- Playback remains `1000ms` base with x1/x2/x4 multipliers.
- WorldSaveV8/V3 numeric payload remains unchanged.
- One successful minute remains `GameMinute → Q1 → Q2 → Q3 → Q4`, revision `+5`.
- Simulation-core remains the only temporal owner; no `temporal-core` package
  was added.

## Worktree and remaining gate

Tracked files are clean. These pre-existing user-owned files remain untracked
and were preserved byte-for-byte:

- `docs/superpowers/plans/2026-08-23-ci-topology-remediation.md`
- `docs/superpowers/plans/2026-08-23-selective-verification-vnext-ownership-precision.md`

The branch has not been pushed. Exact-head GitHub Actions and Sonar remain
required after the non-force push.
