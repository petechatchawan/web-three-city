# Economy Foundation v0.1 — TDD Implementation Plan

**Status:** Implementation complete; final verification pending

**Planning baseline:** `master@f970805fdc6640aa923fded69897c5a43361c970`

**Rule:** Each implementation PR starts from current `master`, remains independently reviewable, and updates living system documentation for contracts it makes real.

## Execution Principles

- Write behavior/contract tests before implementation; do not test private structure.
- Reuse `CommittedWorld`, transaction coordination, GameTime, presentation adapters, and verification governance.
- Keep package dependencies acyclic and candidate publication atomic.
- Use focused owner tests, then affected consumers, then the required repository gate. Targeted browser tags are feedback, not Level 4 authority.
- Record exact-head evidence after the final commit of each PR. Do not add runtime changes after evidence.
- No PR introduces an out-of-scope microeconomy feature or a generic framework without a current consumer.

## PR 1 — Economy Core Foundation

**Goal:** Establish the isolated deterministic domain vocabulary and validation surface.

**Likely files/modules**

- new `packages/economy-core/{package.json,src,test}`;
- workspace/package exports and TypeScript references;
- versioned foundation rules asset;
- architecture/deployment topology tests;
- Economy living documentation status/links.

**RED tests**

- money/rate validators reject fractional, unsafe, non-finite, and out-of-range values;
- checked multiply/divide covers positive/negative half cases and overflow;
- rules reject invalid versions, bounds, or negative costs;
- initial snapshot has the configured treasury/policy, zero accounts, correct period, and settlement marker;
- snapshot clone/validation/fingerprint are stable and mutation-safe;
- package boundary forbids Three/UI/browser and Road/Building/RCI implementation imports.

**GREEN implementation**

- branded/documented `MoneyMinor`, `BasisPoints`, checked arithmetic, typed failures;
- `EconomyRulesV1`, concrete foundation fixture, tax policy, accounting and snapshot contracts;
- pure create/clone/validate/fingerprint functions and public package exports.

**Refactor constraints**

- no class hierarchy, dependency injection container, ledger, event bus, or global mutable rules;
- one rounding implementation and one snapshot validator.

**Integration tests**

- package export/type-consumer fixture;
- repository architecture and package discovery.

**Verification**

```bash
pnpm --filter economy-core test
pnpm test:deployment
pnpm verify
```

**Acceptance / merge gate**

- deterministic arithmetic and versioned rules are frozen by tests;
- no production integration or UI behavior yet;
- Level 3 exact-head pass and clean artifact/worktree evidence.

## PR 2 — Treasury, Policy, and Accounting

**Goal:** Implement pure Economy commands and aggregate period accounting.

**Likely files/modules**

- `packages/economy-core` treasury/policy/accounting command modules and tests;
- public typed result contracts;
- rules and system documentation refinements only where behavior lands.

**RED tests**

- valid tax policy increments revision; invalid/stale policy changes are no-ops with typed codes;
- affordable immediate debit updates treasury and categorized current expenses exactly;
- insufficient funds, invalid quote, stale revision, and overflow preserve snapshots byte-for-byte;
- recurring signed settlement delta can make treasury negative;
- refund credits exact minor units and records current-period refund without rewriting a closed period;
- monthly close copies current to previous, opens zero new period, and is idempotent by tick;
- totals/net are derived correctly and snapshots remain immutable.

**GREEN implementation**

- pure `plan/applyTaxPolicy`, `quote/applyEconomyDelta`, refund receipt, and period close operations;
- discriminated success/rejection results and revision fences;
- aggregate revenue, expense, refund, and derived net projections.

**Refactor constraints**

- no application/world imports and no string-parsed failures;
- no persisted transaction history; receipts contain only command/undo needs.

**Integration tests**

- command sequence replay produces identical snapshots/fingerprints;
- refund after a period close preserves `previousPeriod`.

**Verification**

```bash
pnpm --filter economy-core test
pnpm test:deployment
pnpm verify
```

**Acceptance / merge gate**

- Treasury and accounting authority work in isolation with exact failure semantics;
- Level 3 exact-head pass.

## PR 3 — Taxable Projections and Scheduled Settlement

**Goal:** Compose RCI/Road inputs and settle tax plus maintenance at canonical daily/monthly boundaries.

**Likely files/modules**

- `economy-core` projection validation, revenue/maintenance, and settlement planner;
- `apps/game` immutable projection adapters and game-world tick staging;
- committed-world Economy inclusion, clone/fingerprint/cross-domain validation;
- affected RCI, Road, Building, Simulation, and application tests.

**RED tests**

- residential tax uses occupied dwellings; commercial/industrial use occupied channel positions;
- each channel rounds once after its full integer product;
- maintenance derives from authoritative occupied road cells;
- transition into 08:00 settles once; other hours, pause, and duplicate tick do not settle;
- Day 1 08:00 closes old month before recording the new day's amounts;
- Step triggers one ordinary tick and one eligible settlement only;
- malformed/negative/overflowing projections reject without publication;
- full candidate validation/fingerprint includes Economy.

**GREEN implementation**

- narrow `TaxableActivityProjection` and `RoadMaintenanceProjection`;
- application adapters from staged RCI/Road state;
- pure daily settlement/month rollover planner;
- Economy in staged/committed world and atomic background-tick publication.

**Refactor constraints**

- do not copy RCI/Road state into Economy;
- do not create a second scheduler; use existing GameTime transition semantics;
- maintain one publication for Simulation, Building, RCI, and Economy.

**Integration tests**

- multi-day/month-boundary deterministic scenarios;
- failed background validation leaves the previous committed world untouched;
- same commands/ticks yield the same world fingerprint.

**Verification**

```bash
pnpm --filter economy-core test
pnpm --filter game test
pnpm test:deployment
pnpm verify
```

**Acceptance / merge gate**

- revenue/maintenance and cadence invariants pass across owner and consumer tests;
- no Browser run unless browser-observable behavior was changed;
- Level 3 exact-head pass.

## PR 4 — Paid World Actions, Affordability, and Undo

**Goal:** Make road construction, terraform, and bulldoze economically atomic and reversibly accounted.

**Likely files/modules**

- application command planners/adapters for road, terrain, and bulldoze;
- committed-world transaction candidate/validation integration;
- `UndoCoordinator` typed inverse/receipt model;
- interaction/presentation typed rejection handling;
- unit, application integration, and browser acceptance specs.

**RED tests**

- quotes use validated added/changed/removed plan counts, not raw UI input;
- zoning and automatic RCI growth debit zero;
- unaffordable command publishes neither domain nor Economy and returns typed available/required amounts;
- injected plan, derive, validation, and publication failures consume no money;
- successful paid action publishes one world containing both changes;
- render/presentation failure after publication does not refund or roll back;
- Undo after same-day and post-settlement changes restores the domain and exact command cost while preserving settlement;
- Undo after monthly close refunds into current period without altering previous period;
- invalid/stale inverse rejects atomically and cannot refund twice;
- reset/load clears session Undo; redo remains unavailable.

**GREEN implementation**

- quote adapters, affordability checks, and staged Economy expense deltas;
- deterministic transaction identities and exact receipts;
- domain-specific inverse commands applied to the current world;
- typed presentation mapping for insufficient funds and other failures.

**Refactor constraints**

- extend the existing transaction coordinator; no nested/parallel transaction engine;
- never restore a prior whole Economy/world snapshot for paid Undo;
- keep visual synchronization downstream of publication.

**Integration tests**

- end-to-end road, each terraform mode, road bulldoze, and building bulldoze paths;
- failure injection at every pre-publication boundary;
- rapid command/Undo and background-tick ordering.

**Verification**

```bash
pnpm --filter economy-core test
pnpm --filter game test
pnpm test:deployment
pnpm exec playwright test --grep @road
pnpm exec playwright test --grep @interaction
pnpm verify
pnpm verify:full
```

Run the union of relevant tags during iteration; the final Level 4 command is unfiltered release authority.

**Acceptance / merge gate**

- all paid paths, failures, and exact refund semantics are verified;
- Level 4 exact-head pass with canonical worker/retry configuration and clean evidence.

## PR 5 — Lagged RCI Feedback and Persistence

**Goal:** Connect tax policy to next-cycle RCI demand and make Economy save/load/migration authoritative.

**Likely files/modules**

- `economy-core` tax-pressure projection;
- `rci-core` caller-supplied external-factor seam if not already sufficient;
- `apps/game` Economy-to-RCI adapter and tick composition;
- `WorldSaveV6`, `EconomySaveV1`, decoder/migrations/storage key compatibility;
- deterministic replay and save fixtures.

**RED tests**

- neutral/lower/higher taxes map to zero/positive/negative clamped milli-pressure per channel;
- RCI N+1 reads committed Economy N, never the Economy being settled in that tick;
- policy change affects the next daily evaluation and does not recurse;
- package boundaries remain acyclic;
- Economy save round-trip preserves all owned state and rejects malformed values;
- every supported older WorldSave migrates to configured initial treasury/default policy, current calendar period, zero history, and non-retroactive markers;
- load failure publishes nothing and clears no valid world;
- save/load/continue equals uninterrupted simulation across daily and monthly boundaries.

**GREEN implementation**

- normalized pressure projection and application adapter into RCI external factors;
- stable factor IDs/order and rules-owned weight;
- next WorldSave envelope, Economy codec, legacy migrations, and storage fallback;
- complete-world load validation before publication.

**Refactor constraints**

- no Economy↔RCI package imports;
- no fabricated historical accounts, persisted projections, or clock-based migration;
- preserve all existing save migrations and deterministic seed rules.

**Integration tests**

- policy/tick/settlement/reload/replay scenarios;
- migration fixtures from every supported historical envelope;
- corrupted Economy and stale-rules-version handling.

**Verification**

```bash
pnpm --filter economy-core test
pnpm --filter rci-core test
pnpm --filter game test
pnpm test:deployment
pnpm exec playwright test --grep @rci
pnpm verify
pnpm verify:full
```

**Acceptance / merge gate**

- lag, migration, and continuation invariants pass;
- Level 4 exact-head pass and save compatibility evidence.

## PR 6 — Budget UI, Acceptance, and Milestone Closure

**Execution status:** Implemented; final exact-candidate Level 4 evidence is recorded in the milestone verification record.

**Goal:** Deliver the player-visible municipal loop, complete acceptance coverage, and close the milestone without changing domain authority.

**Likely files/modules**

- application `EconomyViewProjection` and typed tax-policy command boundary;
- UI Toolkit HUD/ Budget panel presenters/styles;
- browser specs/tags, accessibility and mobile layout coverage;
- system docs and final verification/closure record.

**RED tests**

- HUD renders formatted treasury/income/expenses/net from projection only;
- Budget panel renders R/C/I, road/action expense, current/previous periods and policy;
- tax controls submit typed commands, reflect accepted committed state, and expose typed rejection affordances;
- unaffordable road/terraform/bulldoze is visible and leaves world/treasury unchanged;
- responsive mobile interaction, reload, pause/Step, and Undo flows remain usable;
- presenter calculation or failure cannot mutate Economy.

**GREEN implementation**

- pure projection builder and formatter boundary;
- compact HUD and Budget panel using existing presentation architecture;
- application-owned tax command integration and accessible outcomes;
- only the browser coverage needed for scoped behavior.

**Refactor constraints**

- no authoritative arithmetic, snapshots, or direct domain mutation in UI;
- no complex charts or out-of-scope policy systems;
- no global timeout/retry/worker broadening to mask failures.

**Integration and acceptance tests**

- fresh city → spend → settle → policy feedback → save/load → Undo scenarios;
- deterministic replay and performance sanity at representative city size;
- architecture, topology, artifact, and clean-worktree contracts.

**Verification**

During development:

```bash
pnpm --filter game test
pnpm exec playwright test --grep @rci
pnpm exec playwright test --grep @interaction
pnpm exec playwright test --grep @smoke
pnpm verify
```

Final candidate:

```bash
pnpm verify:full
```

Lean CI owns repository checks, unit tests, typecheck, builds, and the exact build artifact. Browser CI consumes that artifact and runs browser acceptance without duplicating Lean work.

**Acceptance / merge gate**

- full scoped gameplay and mobile UI acceptance passes;
- typecheck, unit/domain/integration, architecture, migration, replay, full browser, CI, artifact hygiene, performance sanity, and repository security/quality policy pass on the exact candidate;
- candidate tree equals merged tree;
- authoritative Economy docs and closure evidence are complete;
- milestone may then be marked CLOSED / PASS.

## Milestone Traceability

| Requirement | Owning PRs |
|---|---|
| Money, rules, snapshot, validation | 1 |
| Treasury, tax policy, accounting/close | 2 |
| Tax revenue, road maintenance, cadence | 3 |
| Action costs, affordability, atomicity, Undo | 4 |
| RCI feedback, Save/Load, migration | 5 |
| HUD/Budget UI, browser acceptance, closure | 6 |

## Approval Gate

No production file or implementation branch begins until this specification, five ADRs, and this plan are approved. Approval freezes the v0.1 scope and architectural decisions; balance fixture values may be reviewed in PR 1 but must remain versioned and deterministic.
