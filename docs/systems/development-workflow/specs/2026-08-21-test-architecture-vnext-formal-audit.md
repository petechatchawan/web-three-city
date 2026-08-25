# Test Architecture vNext — Formal Audit (PR-T1)

**Status:** Audit complete — migration not started  
**Date:** 2026-08-21  
**System:** Development Workflow  
**Scope:** Test placement, selective verification, browser authority, and release verification  
**Production behavior:** Unchanged  
**Migration direction:** World of Claudecraft-style verification model, adapted for `web-three-city` with exact-head Three.js/browser release authority

## 1. Decision

`web-three-city` will evolve toward a selective verification architecture with this governing rule:

> Test behavior at the lowest execution layer that can prove it completely. Real browser execution is authoritative only for behavior that actually depends on browser, DOM, CSS/layout, browser APIs, input/raycast/canvas integration, Three.js/WebGL lifecycle, visual output, or browser performance.

The target is intentionally hybrid:

- use Vitest as the dominant deterministic unit/integration authority;
- add changed-source/related-test selection with explicit safety fallbacks;
- separate browser contracts from Three.js integration, critical journeys, visual evidence, and performance evidence;
- keep exact-head browser verification against the Lean-produced Game/Terrain Lab artifacts;
- keep clean-worktree and evidence retention requirements;
- keep Full Browser as an explicit release/shared-infrastructure escalation authority rather than a default debugging loop.

PR-T1 is audit/specification only. It does **not** move, delete, rewrite, or disable tests and does not modify gameplay/runtime behavior.

## 2. Snapshot provenance

This audit is intentionally based on the current PR #83 candidate because that candidate exposed the browser-cost problem that triggered this work.

```text
base trunk at audit start:
master@377ea016a0c537f57aa2cfff27bd622e03a6b060

audited candidate:
feat/motion-junction-realism-v1@eec1eb2fa28cd7f3558a6fe83efe2fc7dab376bb

exact CI evidence:
workflow run 32455193092
```

PR-T1 is stacked from the audited candidate so the documentation diff remains audit-only. After the parent feature branch lands, PR-T1 can be retargeted to `master` without carrying the parent feature implementation in its diff.

## 3. Current verification topology

The repository already has a strong proportional verification policy. This audit does not replace it from scratch.

Current policy is:

```text
Level 0  focused Vitest iteration
Level 1  owning package test + typecheck
Level 2  conservative static consumer map
Level 3  pnpm verify / Lean CI
Level 4  Full Browser only when explicitly escalated
```

Browser-observable PRs already use targeted ownership tags and Full Browser is already opt-in for release/milestone closure, shared browser infrastructure, `full-ci`, manual dispatch, or nightly regression.

The vNext problem is therefore narrower and more actionable:

1. browser tests currently mix several different kinds of authority;
2. targeted selection is feature/tag-centric rather than changed-source-centric;
3. some deterministic assertions are reached through a real browser even when browser truth is not the thing under test;
4. some truly browser-dependent fixture matrices pay repeated page/bootstrap cost per case;
5. the static Level 2 map has no graph-safe/partial/graph-blind classification yet.

## 4. Baseline inventory

### 4.1 Deterministic / non-browser tests

Exact candidate CI reports the following Vitest inventory across workspace packages:

```text
Vitest test files: 255
Vitest tests:      1,032
```

The Game workspace alone is guarded by repository topology tests at:

```text
apps/game:
93 files
375 tests
```

Repository/deployment tooling adds:

```text
node:test deployment/tooling tests: 60
```

Therefore the repository already has a substantial lower-layer test base. Testing vNext is primarily a **placement and selection** migration, not a request to replace Playwright coverage with an entirely new test stack.

### 4.2 Browser tests

Repository topology currently freezes:

```text
Playwright spec files:       33
Chromium browser tests:     148
Browser project:       chromium only
fullyParallel:               false
CI workers:                      1
local workers:                   2
retries:                         1
trace:            retain-on-failure
screenshot:        only-on-failure
```

CI runs the browser suite from the exact preview artifacts produced by Lean CI rather than rebuilding the applications in the Browser job.

### 4.3 Measured exact-head cost

Exact run `32455193092` is the primary timing evidence for this audit.

```text
Lean CI job:                         ~3m 08s
Targeted browser tags:          @road | @traffic
Selected Chromium tests:                  60 / 148
Playwright execution:                      9.9m
Browser job total:                       ~10m 22s
Result:                              60 / 60 PASS
```

A bounded Road + Traffic change therefore selects about **40.5% of the entire browser inventory** and the browser phase takes over three times as long as Lean CI.

This is the current high-value optimization target. Full Browser is not the normal PR bottleneck; a broad targeted feature union is.

## 5. Measured browser-cost observations

### F1 — Existing policy is already partly aligned with the target

The repository already avoids Full Browser on every PR, already has package-scoped Vitest loops, and already reuses exact Lean artifacts. The migration must preserve these strengths.

The largest architectural change is not "stop running Full Browser". It is:

```text
feature-tag selection
        ↓
changed-source + authority-aware selection
```

while retaining browser evidence where browser truth is required.

### F2 — Browser ownership tags do not describe test authority

Current filenames/tags describe domains such as `@road`, `@traffic`, `@building`, and `@interaction`. They do not distinguish:

- deterministic domain authority;
- application integration;
- DOM/browser contract;
- Three.js/WebGL integration;
- critical cross-system journey;
- visual evidence;
- performance evidence.

As a result, one tag union can pull in tests with very different cost and justification.

### F3 — Road fixture matrix pays repeated browser bootstrap cost

`browser-tests/road.@road.spec.ts` contains 21 valid Terrain Lab road fixtures. Each fixture is a separate Playwright test and performs its own page navigation before reading Road/Three.js evidence.

On exact run `32455193092`, those 21 tests consumed approximately **97.1 seconds** in aggregate before the invalid-preview and interaction cases were counted.

The assertions include legitimate Three.js/presentation facts such as committed/preview root counts and estimated geometry bytes, so they must not simply be converted to Node assertions. However, the current one-browser-test-per-fixture shape is not required to preserve that authority. PR-T3 should evaluate:

- lower-layer coverage for deterministic topology/validity facts; and
- a smaller/batched browser matrix for actual Three.js materialization facts.

### F4 — Several browser tests combine lower-layer authority with browser authority

Examples:

- Traffic Save/Load verifies exact Simulation/Mobility/Traffic state, schema versions, browser `localStorage`, and post-load presentation in one Playwright scenario.
- Traffic Road Recovery drives a real Bulldoze interaction/raycast and then verifies detailed deterministic route-recovery state.
- Growth tests mix deterministic construction-per-tick rules with UI/input isolation and browser persistence.
- Economy tests mix UI selection with committed tax-policy persistence.
- RCI tests mix HUD/dialog semantics with background-tick and Save assertions.

These are **split candidates**, not deletion candidates. The deterministic contract should be proved lower; a thinner browser scenario should remain when browser composition/storage/UI/input is still material.

### F5 — Genuine browser/Three.js authority is common and must remain

The audit found many tests whose core claim cannot be downgraded safely:

- responsive/mobile layout and containment;
- DOM roles, focus, dialogs, and interaction state;
- pointer/touch ownership and pointer release;
- camera-relative movement;
- world-space selection/raycast;
- active strokes while background simulation changes;
- Three.js committed/preview roots;
- WebGL context restoration;
- visible-pixel/visual evidence;
- requestAnimationFrame/browser performance and presentation caps.

Testing vNext therefore retains a first-class exact-head Three.js Browser Authority. Browser is not treated as an implementation accident.

### F6 — Fixed wall-clock waits still exist

At least one current browser test (`rci.@rci@smoke.spec.ts`) uses a fixed `waitForTimeout(1_500)` to allow background RCI ticks before asserting that the active zoning tool was not interrupted.

Testing vNext should prefer deterministic stepping or condition-based waiting whenever the contract is logical state rather than wall-clock behavior. Fixed waits remain acceptable only when elapsed wall time itself is the behavior being proved.

### F7 — Real browser performance evidence is correctly placed

`citizen-mobility-traffic-performance.@traffic@release.spec.ts` uses real `requestAnimationFrame`, presentation materialization/pool reuse, spatial culling, and browser performance/memory observations. This is genuine browser-performance evidence and should remain outside ordinary deterministic fast gates.

The test's current 5,000-trip case took about 34.5 seconds on the exact targeted run. Its cost is justified differently from a deterministic Traffic-core contract and must be scheduled accordingly.

### F8 — The current selective mechanism is manual and graph-blind

Targeted CI reads a PR-body line such as:

```text
Targeted browser tags: road traffic
```

and maps that declaration to a tag union. There is no changed-file dependency analysis or explicit risk model for dependencies hidden behind:

- runtime registries;
- event buses/custom events;
- string IDs and definition registries;
- application composition;
- browser globals/test APIs;
- persistence schemas;
- CSS/layout selectors;
- dynamic loading;
- shared browser fixtures/harnesses.

A safe `vitest related` migration therefore requires explicit graph-blind fallbacks. Import-graph reachability alone is not sufficient authority.

### F9 — Test-topology verification has measurable cost too

`pnpm test:deployment` deliberately invokes Vitest and Playwright list/discovery commands to prove current inventory/topology. On the audited CI run the deployment/tooling suite took roughly 35 seconds, with Game inventory and Playwright-selection topology checks accounting for most of that time.

This is worth optimizing later, but it is secondary to the browser execution cost and must not be weakened merely to shorten Lean CI.

### F10 — Retry policy is an infrastructure policy, not a product-failure escape hatch

Playwright currently uses one retry, documented as protection against rare browser-process failure under CPU-heavy SwiftShader execution. PR-T1 does not change this. Any future retry change must distinguish infrastructure failure from deterministic product/test failure and be backed by measured evidence.

## 6. Target test taxonomy

Every test must have one primary authority class. Cross-cutting tests may contain supporting assertions from another class, but their primary reason for execution must be explicit.

| Class | Authority | Default tool | Examples |
| --- | --- | --- | --- |
| **L1 Unit** | deterministic local behavior | Vitest | formulas, planners, reducers, topology rules, compatibility |
| **L2 Integration** | deterministic package/app composition without real-browser dependency | Vitest / `happy-dom` only where DOM emulation is sufficient | Road→Traffic projection, Save encode/decode, Simulation→Growth, RCI/Economy orchestration |
| **L3 Browser Contract** | real DOM/CSS/browser semantics | real Chromium, preferably Vitest Browser Mode where isolation fits | responsive shell, dialogs, roles/focus, browser APIs |
| **L4 Three.js Integration** | real canvas/input/raycast/WebGL/Three.js composition | Playwright against exact built Game/Terrain Lab | pointer→cell, camera/input, world materialization, context restore |
| **L5 Critical E2E** | a small end-user cross-system journey | Playwright against exact built artifact | build→world mutation→dependent system→visible result |
| **Evidence profile** | visual or performance evidence, not a new logic layer | Playwright / dedicated browser evidence runner | visual captures, rAF performance, large presentation fixtures |

`Full Regression` is an **execution profile**, not a sixth test layer.

## 7. Initial browser-spec classification

This table is an audit classification, not permission to delete tests. `SPLIT` means replacement lower-layer coverage must be GREEN before any browser assertion can be removed.

| Current spec | Initial target authority | PR-T2/PR-T3 disposition |
| --- | --- | --- |
| `building.@building@smoke.spec.ts` | L4/L5 | keep browser; audit deterministic assertions for duplication |
| `building.@building@visual@release.spec.ts` | Evidence | keep browser, release/evidence profile |
| `citizen-mobility-traffic-commute.@traffic@visual@release.spec.ts` | L5 + Evidence | keep a critical journey; split lifecycle-only assertions where already deterministic |
| `citizen-mobility-traffic-mobile-regression.@traffic@interaction@release.spec.ts` | L3 | keep browser contract |
| `citizen-mobility-traffic-performance.@traffic@release.spec.ts` | Evidence | keep real-browser performance profile |
| `citizen-mobility-traffic-road-recovery.@traffic@road@release.spec.ts` | L2 + L4/L5 | **SPLIT** route recovery lower; retain real Bulldoze/raycast integration |
| `citizen-mobility-traffic-save-load.@traffic@release.spec.ts` | L2 + L3/L5 | **SPLIT** exact state/schema lower; retain browser storage/composition smoke |
| `citizen-mobility-traffic-ui.@traffic@interaction@release.spec.ts` | L3 | keep browser; move purely deterministic non-mutation facts lower if duplicated |
| `city-ui-dialogs.@rci@interaction.spec.ts` | L3 | keep browser contract |
| `city-ui-inspect-information.@interaction@building@road@zoning.spec.ts` | L3/L5 | keep browser cross-system interaction |
| `city-ui-m6-4-mobile-declutter.@interaction@rci@release.spec.ts` | L3 | keep browser responsive/containment contract |
| `city-ui-responsive.@interaction@smoke@release.spec.ts` | L3 | keep browser responsive contract |
| `economy.@rci@interaction@smoke.spec.ts` | L2 + L3 | **SPLIT** policy/persistence lower; retain UI/storage binding smoke |
| `game.@interaction@smoke.spec.ts` | L3/L5 | keep small critical browser smoke; trim deterministic duplication |
| `growth-reservation.@building.spec.ts` | L4/L5 | keep active-stroke/background-operation browser integration |
| `growth-visual-evidence.@building@visual@release.spec.ts` | Evidence | keep browser visual profile |
| `growth.@building.spec.ts` | L2 + L3/L4 | **SPLIT** deterministic growth/save rules lower; retain time-control/tool-isolation browser contracts |
| `interaction-conformance.@interaction@smoke.spec.ts` | L4 | keep browser input/raycast authority |
| `interaction.@interaction.spec.ts` | L4 | keep browser input/canvas authority |
| `rci.@rci@smoke.spec.ts` | L2 + L3 | **SPLIT** Save/background-state facts lower; retain HUD/dialog contract; remove fixed waits where logical stepping suffices |
| `road-operation-aware-interaction.@road@interaction.spec.ts` | L4 | keep browser Three.js/input authority |
| `road-reversible-stroke.@road@interaction.spec.ts` | L4 | keep browser stroke/camera authority |
| `road-visibility.@road@visual.spec.ts` | Evidence/L4 | keep real visible-pixel evidence |
| `road-visual-evidence.@road@visual@release.spec.ts` | Evidence | keep browser visual/release profile |
| `road.@road.spec.ts` | L2 + L4 | **SPLIT/BATCH** deterministic validity lower; batch/reduce repeated browser fixture bootstrap while preserving Three.js materialization cases |
| `terraform-visual-evidence.@terrain@visual@performance@release.spec.ts` | Evidence | keep browser visual/performance profile |
| `terraform.@terrain.spec.ts` | L2 + L4 | **SPLIT** planner/state lower; retain canvas/raycast/Three.js authority |
| `terrain-lab.@terrain@water.spec.ts` | L4 | keep browser lab-composition authority |
| `transaction-release.@road@interaction.spec.ts` | L4 | keep pointer-release/browser ownership authority |
| `visual-evidence.@terrain@water@visual@performance@release.spec.ts` | Evidence | keep browser visual/performance profile |
| `water.@water.spec.ts` | L2 + L4 | **SPLIT** derivation contracts lower; retain Three.js/browser materialization authority |
| `zoning-visual-evidence.@zoning@visual@release.spec.ts` | Evidence | keep browser visual/release profile |
| `zoning.@zoning.spec.ts` | L2 + L4 | **SPLIT** eligibility/state lower; retain paint/input/overlay integration |

The audit conclusion is **not** that most browser specs should disappear. It is that many mixed specs should become thinner and that browser evidence should be grouped by the kind of browser truth it proves.

## 8. Selective-verification dependency classes

Changed-source selection must classify files/dependencies into four safety classes.

### GRAPH_SAFE

Import graph and colocated tests fully expose the impact surface.

Examples:

- pure core utility;
- deterministic planner/reducer with static imports;
- package-local value object/formula.

Execution:

```text
vitest related
+ owning package typecheck
```

### PARTIAL

Most consumers are visible statically, but there is an established cross-package/public-contract boundary.

Examples:

- exported domain contract consumed by `apps/game`;
- Save-facing types;
- core snapshot used by a `*-three` adapter.

Execution:

```text
vitest related
+ mandatory owner/consumer contract set
```

The current Level 2 map is the initial conservative source for this mandatory set.

### GRAPH_BLIND

Material behavior is connected through mechanisms ordinary import reachability cannot prove safely.

Examples:

- event/custom-event contracts;
- runtime registries and string IDs;
- browser globals/test APIs;
- CSS/data-attribute contracts;
- dynamic composition;
- shared browser fixture/harness semantics.

Execution:

```text
related deterministic tests
+ named mandatory contract suite
+ affected browser authority when observable
```

### GLOBAL

A change can alter test discovery, build/runtime composition, or repository-wide behavior.

Examples:

- `package.json` / lockfile dependency topology;
- TypeScript/Vitest/Playwright/Vite configuration;
- pnpm workspace configuration;
- CI workflow;
- shared browser helpers/harness;
- application-wide input/navigation/modal infrastructure;
- persistence/world schema with broad consumers.

Execution:

```text
full deterministic gate
+ browser escalation according to actual affected authority
```

`GLOBAL` does not automatically mean Full Browser for every tooling change. It means related-test selection alone is insufficient. Browser escalation still follows browser-impact scope.

## 9. Proposed execution profiles

Names are provisional until PR-T2 validates them against existing scripts.

### Developer fast loop

```text
changed files
  ↓
classify dependency risk
  ↓
Vitest related / owner tests
  + mandatory graph-blind contracts
  + targeted browser only when the changed behavior is browser-observable
```

Target: seconds for ordinary deterministic edits, without weakening required browser proof.

### PR gate

```text
Lean / pnpm verify authority
  + affected deterministic consumers
  + affected L3/L4/L5 browser authority
  + exact artifact reuse
  + clean-worktree evidence
```

The current manual tag mechanism remains operational during migration until the replacement selector is verified safe.

### Release gate

```text
exact candidate HEAD
  ↓
full deterministic suite
  ↓
L3 browser contracts required by release profile
  ↓
L4 Three.js integration authority
  ↓
L5 critical E2E
  ↓
required visual/performance/full regression profile
  ↓
clean worktree + retained evidence
```

This exact-head Three.js release path is the intentional `web-three-city` adaptation and must not be removed merely to match another repository's testing topology.

## 10. Migration invariants

The following are hard constraints for PR-T2 onward:

1. **No browser test deletion before replacement evidence is GREEN.**
2. **Coverage is moved, not discarded.** A browser assertion removed as deterministic duplication must have an authoritative lower-layer replacement.
3. **Browser truth stays browser truth.** DOM/CSS, browser APIs, input/raycast/canvas, Three.js/WebGL, visual, and real-browser performance claims cannot be replaced with happy-dom or pure Node tests.
4. **Exact Lean artifact reuse stays.** Browser authority verifies the same built candidate produced by Lean CI.
5. **Exact-head evidence stays.** A later documentation-only commit must not invalidate release evidence.
6. **Clean-worktree verification stays.** Test execution must not leave untracked/generated state.
7. **Selective verification must fail safe.** Unknown or graph-blind impact expands verification; it never silently selects nothing.
8. **Do not optimize by hiding failures.** Worker, retry, timeout, and sharding policy changes require measured evidence.
9. **Do not make test count a success metric.** Fewer browser tests is useful only when authority and coverage are preserved or improved.
10. **No production behavior changes are permitted solely to make migration easier.** Test seams may be added only when they preserve production authority and are explicitly justified.

## 11. PR-T2 inputs

PR-T2 should build verification infrastructure only. It should not yet perform broad domain migration.

Required inputs from this audit:

1. introduce machine-readable test authority metadata/classification for L1-L5/evidence;
2. add `test:related`/affected deterministic execution using native Vitest capabilities where safe;
3. add a dependency-risk registry supporting `GRAPH_SAFE`, `PARTIAL`, `GRAPH_BLIND`, and `GLOBAL` fallbacks;
4. preserve the existing Level 2 static map as a safety net until automated dependent selection is proven at least as conservative;
5. separate browser execution profiles so Browser Contract, Three.js Integration, Critical E2E, Visual, and Performance can be selected independently;
6. evaluate Vitest Browser Mode + Playwright provider for isolated L3 browser contracts, without forcing L4/L5 Three.js journeys off the existing Playwright Test harness;
7. keep current Playwright suite and CI routing intact until new profiles are verified against the same exact inventory;
8. add topology contract tests proving no browser spec silently falls out of all execution profiles;
9. collect timing/evidence in machine-readable form so later PRs can compare fast/PR/release paths;
10. do not change production code or browser worker/retry policy in PR-T2 unless a separate measured decision is approved.

## 12. Recommended migration sequence after PR-T2

```text
PR-T1  Formal audit/spec                          ← this document
PR-T2  Verification infrastructure, no coverage deletion
PR-T3  Roads + Traffic pilot migration
PR-T4  Changed-source selective verification + safety fallbacks
PR-T5  Remaining deterministic/mixed-domain migration
PR-T6  Browser/Three.js/E2E profile cutover + release-policy closure
```

Roads + Traffic remains the recommended pilot because the exact run already exposes both sides of the architecture:

- many deterministic/core contracts;
- expensive repeated Road browser fixture bootstraps;
- genuine canvas/raycast/stroke/WebGL authority;
- real Traffic presentation/performance evidence;
- mixed Save/recovery journeys that can demonstrate safe test splitting.

## 13. PR-T1 acceptance criteria

PR-T1 is complete when:

- current non-browser and browser inventories are recorded;
- the exact audited candidate/run are recorded;
- current worker/retry/artifact/CI topology is recorded;
- existing strengths are explicitly preserved;
- browser specs have an initial authority classification;
- graph-safe/partial/graph-blind/global risk classes are defined;
- migration invariants prevent coverage deletion and browser-authority erosion;
- PR-T2 has concrete inputs;
- no test, CI gate, package configuration, browser configuration, or production behavior has changed.

## 14. Formal audit conclusion

The repository does **not** have a simple "too many tests" problem. It has a **verification placement and execution-profile problem**.

The exact candidate already has more than one thousand deterministic Vitest tests and a proportional Level 0–4 policy. The expensive path is that targeted Playwright ownership unions can still select a large fraction of a 148-test Chromium suite, and mixed browser specs sometimes use Chromium as the route to assertions whose primary authority is deterministic state.

Testing Architecture vNext should therefore optimize in this order:

```text
1. classify authority
2. move deterministic proof downward
3. retain thin real-browser proof where browser composition matters
4. batch/reduce repeated real-browser bootstrap where authority is unchanged
5. select tests from changed-source impact with fail-safe graph-blind fallbacks
6. retain exact-head Three.js release authority
```

That is the approved architectural direction for PR-T2 planning. It preserves the repository's strongest release guarantees while moving ordinary development feedback toward the World of Claudecraft-style selective model.