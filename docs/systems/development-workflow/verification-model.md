# Verification Infrastructure — Authority-Aware Routing

**Status:** Implemented — PR-T2 foundation with PR-T3.3 authority semantics
**Relation:** builds on PR-T1 (Formal Test Architecture Audit) and PR-T2 (Verification Infrastructure Foundation)
**System:** Development Workflow

## Purpose

The resolver establishes a deterministic answer to one question:

> From these changed files, what verification must run?

The output is a **verification plan** with authority and risk kept separate. A
test metadata change can request exact topology/deployment checks or targeted
browser evidence without becoming a shared browser-infrastructure change.

## Architecture

```text
Changed Files
      |
      v
Authority Classifier tooling/verification/authority.mjs
      |
      v
Impact Resolver      tooling/verification/resolver.mjs
      |
      v
Ownership + Risk     tooling/verification/ownership.mjs + risk.mjs
      |
      v
Verification Plan   authority + systems + risk + checks + browser mode
      |
      v
Affected Execution  owner tests -> consumers -> typechecks -> browser
```

Planning entry point: `pnpm verify:impact <changed files...>` (`tooling/verify-impact.mjs`).
Execution entry point: `pnpm verify:affected -- --base <sha> --head <sha> [--json]`
(`tooling/verify-affected.mjs`).

CI computes the plan once with `--plan-only --output affected-verification-plan.json`.
Each fan-out lane consumes that exact published file with `--plan-file` and selects
only its command kind: `lint`, `owner-tests`, `consumer-tests`, `typecheck`,
`deployment`, or `browser`. This keeps changed-source selection deterministic while
allowing independent work to run in parallel. The Browser lane consumes the exact
Game/Terrain Lab artifact from `browser_build`; it is not serialized behind the Lean
aggregate.

## Risk Classification

| Risk          | Meaning                                                 | Examples                                                                                  |
| ------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GRAPH_SAFE`  | Dependency clear; related tests trustworthy.            | pure utility, isolated domain logic                                                       |
| `PARTIAL`     | Multiple consumers; requires static expansion.          | package API, shared domain module                                                         |
| `GRAPH_BLIND` | Import graph insufficient.                              | runtime registry, event bus, dynamic lookup, string identifiers, runtime composition      |
| `GLOBAL`      | Shared verification/configuration authority is changed. | package.json, lockfile, Vite/Playwright config, CI, resolver, shared verification scripts |

Risk is ordered low → high. When merging multiple changes, the **highest** risk wins.

## Ownership Model (source of truth)

`tooling/verification/ownership.mjs` is the canonical ownership map. Every owner declares:

- `system` — canonical package name;
- `risk` — `VerificationRisk` for a direct change;
- `verification` — affected package verification targets;
- `browserTags` — Playwright ownership tags required when directly changed;
- `consumers` — static Level-2 expansion consumers (extra verification is safe).

`tooling/verification/authority.mjs` classifies the changed-file authority
before risk is merged:

| Authority             | Meaning                                 | Browser consequence                                                                        |
| --------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `PRODUCT_SOURCE`      | Owned production source                 | owner + Level-2 consumers; browser only when the direct owner requires it                  |
| `DETERMINISTIC_TEST`  | Unit/application test below the browser | owner/consumer tests; no browser by itself                                                 |
| `BROWSER_CONTRACT`    | Tagged Playwright contract              | targeted ownership tags; no Full Browser by itself                                         |
| `TEST_TOPOLOGY`       | Inventory/discovery/topology assertion  | exact deployment/topology checks; no Full Browser by itself                                |
| `SHARED_VERIFICATION` | Resolver, CI, config, or shared harness | `GLOBAL`; Full Browser escalation                                                          |
| `GRAPH_BLIND_RUNTIME` | Dynamic/unknown runtime composition     | conservative owner/browser expansion; Full Browser only when policy explicitly requires it |

Audit-required packages added by PR-T2:

- `citizen-mobility-core` (PARTIAL, consumers `traffic-core`, `game`)
- `traffic-core` (PARTIAL, consumers `traffic-three`, `game`)
- `traffic-three` (GRAPH_SAFE, browser tag `@traffic`)

Note: `browserRequired` is driven by the **direct changed owner**, not by expanded
consumers. A pure-domain change (e.g. `traffic-core`) does not force browser
verification merely because a presentation consumer (`traffic-three`) owns browser specs.
Browser requirement for `traffic-core` is satisfied by `traffic-core:test` + the
expanded `traffic-three:test` (Vitest), not by the `@traffic` browser suite.

## Authority-Aware Escalation Rules (fail-safe)

```text
Unknown  ──────────────►  GRAPH_BLIND
Shared verification/config ─► GLOBAL
Safety > optimization
```

- Unknown file ownership → escalate to `GRAPH_BLIND` (never under-verify).
- A tagged `browser-tests/*.spec.*` file → `BROWSER_CONTRACT` with its ownership tag(s), targeted browser, and `fullBrowserRequired: false`.
- `tooling/test-topology.test.mjs` and inventory guards → `TEST_TOPOLOGY` with `deploymentRequired: true` and `fullBrowserRequired: false`.
- Shared resolver/config/CI/harness files → `SHARED_VERIFICATION` with `GLOBAL`, `verify:full`, and `fullBrowserRequired: true`.
- `GRAPH_BLIND` always sets `browserRequired: true`.

Persistence and application integration are not automatically `GLOBAL`; they
are classified by their actual owning source/test boundary. Shared schema or
bootstrap infrastructure may still escalate explicitly when it changes the
execution contract.

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

JSON variant: `pnpm verify:impact --json <files...>`. The JSON plan includes
`entries`, `authority`, `fullBrowserRequired`, and `deploymentRequired` so CI
can consume the same decision without reclassifying paths.

## Affected Execution Contract (PR-T4)

`buildAffectedExecutionPlan` converts one resolver result into an exact-head
execution plan:

```json
{
  "ownerTests": [{ "workspace": "@web-three-city/traffic-core", "files": [], "mode": "package" }],
  "consumerTests": [{ "workspace": "@web-three-city/game", "files": [], "mode": "package" }],
  "typechecks": ["@web-three-city/traffic-core", "@web-three-city/game"],
  "deploymentChecks": false,
  "lintFiles": ["packages/traffic-core/src/graph.ts"],
  "browser": { "mode": "targeted", "tags": ["@traffic"], "fullBrowserRequired": false },
  "exactHead": { "baseSha": "...", "headSha": "..." }
}
```

`mode: files` runs changed deterministic tests directly. `mode: related` runs
Vitest related to changed production source. `mode: package` runs the owning
or conservative consumer workspace. Commands are passed to Node `execFile`
as executable plus argument arrays; paths are never interpolated into a shell
command. `--skip-browser` is used by Lean so Browser remains the sole owner of
Playwright execution.

The plan job uses a full-depth/equivalent base checkout and publishes the exact
owner/consumer/typecheck/deployment/browser plan. The non-browser lanes consume
that artifact independently; Lean aggregates their status without rerunning them
through `pnpm check`. When browser evidence is required, `browser_build` packages
the plan with the exact Game/Terrain Lab artifact. Browser reads the plan and runs
targeted tags or explicit Full Browser. The Browser job removes the downloaded plan before clean-worktree
verification.

## Selective Verification vNext ownership precision

The affected-plan model applies to every system, not only Road and Traffic.
Direct package owners provide the baseline Browser tags for Terrain, Water,
Road, Zoning, Building, RCI, Traffic, and Interaction. Deterministic
Economy, Simulation, Mobility, and Traffic-core source remains below Browser.

`apps/game` is not a single Browser owner. Its concrete paths must be
classified by authority: deterministic application paths select owner and
consumer verification with Browser `none`; bounded presentation paths select
only their system tag(s); unbounded bootstrap/composition paths fail closed to
`GRAPH_BLIND`/Full Browser. A source file's system name alone is not enough to
request Browser evidence.

The approved examples are:

```text
apps/game/src/traffic-transport-transaction.ts → Browser none
apps/game/src/traffic-presentation.ts          → targeted @traffic
apps/game/src/terraform-water-projection.ts    → targeted @water
apps/game/src/zone-building-presentation.ts    → targeted @building|@zoning
apps/game/src/game-bootstrap.ts                → GRAPH_BLIND + Full Browser
```

The path-aware rules are implemented and tested separately from the CI
topology. They must not introduce a blanket `apps/game/**` tag union, change
Playwright assertions, or change the Full Browser 137-test authority.

## Tests

- `tooling/verification/verification-resolver.test.mjs` — resolver behavior (TDD RED first).
- `tooling/verification-resolver.test.mjs` — rover-level contract incl. audit packages + CLI.
- `tooling/verification-execution.test.mjs` — exact owner/consumer/Browser execution-plan contracts.
- Both run inside `pnpm test:deployment`.

## Safety Invariants

PR-T2 preserves all existing authority:

- No production behavior changed.
- No gameplay/runtime logic changed.
- No Playwright tests migrated, removed, or reduced by this resolver change.
- Existing worker, retry, and timeout policy remains unchanged. CI topology remediation changes only affected lane scheduling and artifact ownership; `pnpm check` remains the Level 3 local/finalization gate, while the normal PR aggregate is the exact affected lane set.
- `pnpm verify`, `pnpm verify:full`, Lean CI artifact flow, deterministic browser
  verification, clean-worktree evidence, and release-gate discipline unchanged.

## Non-Goals (PR-T2)

- Migrate Playwright tests.
- Remove or reduce browser coverage.
- Change CI gate execution or browser infrastructure.
- Replace the static Level 2 map (that remains the conservative authority; this
  ownership model is complementary input for PR-T3).

## Next

System pilots remain separate stacked PRs and must follow lower-layer RED → GREEN
→ browser narrowing. PR-T4 is the execution foundation; it does not migrate or
delete Playwright tests.
