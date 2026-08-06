# Living System Documentation Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish concise, system-centric living documentation that preserves current behavior, design history, architectural decisions, implementation plans, and verification evidence in predictable locations.

**Architecture:** `docs/systems/<system>/README.md` is the current-state handoff authority for each system. Historical and change-specific artifacts live beside it in `specs/`, `adrs/`, `tdd/`, and `verification/`; legacy `docs/superpowers/` content remains readable during phased migration but is not the canonical home for new artifacts.

**Tech Stack:** Markdown, Mermaid, GitHub pull requests, repository-relative links.

## Global Constraints

- Living overviews must be concise and describe only behavior verified on the referenced branch or explicitly marked planned.
- Every document must state status, ownership, integrations, persistence, invariants, limitations, and related source/spec links when applicable.
- A fact must have one canonical owner; do not duplicate full specifications across paths.
- New specs, ADRs, TDD plans, and verification reports must be filed under the owning system.
- Existing legacy documents are migrated incrementally with redirects or migration indexes; history must not be silently rewritten.
- Planned systems must never be described as implemented.
- Changes to system behavior or public contracts require the relevant living overview to change in the same PR.

---

### Task 1: Establish documentation governance and templates

**Files:**
- Create: `docs/systems/README.md`
- Create: `docs/systems/_templates/system-overview.md`
- Create: `docs/systems/_templates/spec.md`
- Create: `docs/systems/_templates/adr.md`
- Create: `docs/systems/_templates/tdd-plan.md`
- Create: `docs/systems/documentation/README.md`
- Create: `docs/systems/documentation/specs/2026-08-06-living-system-documentation-foundation-v0-1.md`
- Create: `docs/systems/documentation/adrs/0001-system-centric-documentation.md`

**Interfaces:**
- Consumes: existing `docs/superpowers/` layout and current repository package boundaries.
- Produces: canonical location rules, status vocabulary, update checklist, and reusable handoff templates.

- [ ] **Step 1:** Add the system registry and governance rules.
- [ ] **Step 2:** Add concise templates for overview, spec, ADR, and TDD documents.
- [ ] **Step 3:** Document this documentation system itself and record ADR-0001.
- [ ] **Step 4:** Verify all relative links and confirm no template contains `TODO` or `TBD`.
- [ ] **Step 5:** Commit the governance foundation.

### Task 2: Backfill concise living overviews for implemented foundations

**Files:**
- Create: `docs/systems/world/README.md`
- Create: `docs/systems/terrain/README.md`
- Create: `docs/systems/water/README.md`
- Create: `docs/systems/roads/README.md`
- Create: `docs/systems/zoning/README.md`
- Create: `docs/systems/buildings/README.md`
- Create: `docs/systems/simulation-time/README.md`

**Interfaces:**
- Consumes: `world-core`, `terrain-core`, `water-core`, `road-core`, `zone-core`, `building-core`, `simulation-core`, and `apps/game` integration contracts.
- Produces: current-state handoff pages that identify authority, workflows, dependencies, persistence, invariants, limitations, and extension boundaries.

- [ ] **Step 1:** Write one concise current-state overview per implemented system.
- [ ] **Step 2:** Mark exact package and Save ownership without copying full milestone specs.
- [ ] **Step 3:** Add Mermaid dependency diagrams only where they materially clarify integration.
- [ ] **Step 4:** Cross-check each overview against current source contracts and `WorldSaveV4`.
- [ ] **Step 5:** Commit the implemented-system overviews.

### Task 3: Move active RCI design into the system-centric structure

**Files:**
- Create: `docs/systems/rci/README.md`
- Move: `docs/superpowers/specs/2026-08-06-rci-demand-occupancy-foundation-v0-1-design.md` → `docs/systems/rci/specs/2026-08-06-rci-demand-occupancy-foundation-v0-1.md`
- Create: `docs/systems/rci/adrs/0001-citizen-records-as-population-authority.md`

**Interfaces:**
- Consumes: approved RCI design and current Building/Simulation integration.
- Produces: one concise planned-state handoff, one canonical design spec, and one durable authority decision.

- [ ] **Step 1:** Relocate the unmerged RCI specification without maintaining a duplicate canonical copy.
- [ ] **Step 2:** Add the RCI living overview with status `Approved design — not implemented`.
- [ ] **Step 3:** Record citizen records and historical assignments as the population authority in ADR-0001.
- [ ] **Step 4:** Verify all links from the RCI overview and PR description.
- [ ] **Step 5:** Commit the RCI documentation relocation.

### Task 4: Add planned-system boundary documentation

**Files:**
- Create: `docs/systems/economy/README.md`

**Interfaces:**
- Consumes: current scope exclusions and future RCI extension boundaries.
- Produces: a non-authoritative planned boundary that prevents Economy concerns from leaking into RCI v0.1.

- [ ] **Step 1:** State that Economy is planned and has no authoritative runtime state.
- [ ] **Step 2:** Define intended responsibilities and expected dependencies without locking formulas.
- [ ] **Step 3:** List decisions intentionally deferred.
- [ ] **Step 4:** Commit the planned boundary.

### Task 5: Add migration guidance and repository entry points

**Files:**
- Create: `docs/superpowers/README.md`
- Modify: `README.md`
- Modify: Draft PR #25 description

**Interfaces:**
- Consumes: the new system registry and existing legacy artifacts.
- Produces: clear navigation from the repository root and an explicit phased-migration policy.

- [ ] **Step 1:** Explain that `docs/superpowers/` is a legacy workflow archive and that new artifacts are system-centric.
- [ ] **Step 2:** Update the repository README to link to `docs/systems/README.md` and current milestone status.
- [ ] **Step 3:** Update PR #25 to describe both RCI design and the living documentation foundation.
- [ ] **Step 4:** Verify the branch diff contains documentation only and no duplicate RCI spec.
- [ ] **Step 5:** Commit and review the final documentation tree.

## Verification Checklist

- [ ] `docs/systems/README.md` lists every created system and its truthful status.
- [ ] Every system README includes purpose, ownership, authority, integrations, persistence, invariants, limitations, and related documents.
- [ ] RCI has exactly one canonical full design specification.
- [ ] New documentation artifacts are grouped by owning system.
- [ ] Planned Economy content is clearly marked unimplemented.
- [ ] Legacy navigation explains phased migration and does not claim legacy paths are canonical for new work.
- [ ] No `TODO`, `TBD`, or unresolved placeholder remains.
- [ ] All relative Markdown links resolve within the branch.
- [ ] PR #25 remains documentation-only and Draft until the RCI written specification is approved.
