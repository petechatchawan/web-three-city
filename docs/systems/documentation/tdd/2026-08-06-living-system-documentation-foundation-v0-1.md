# Living System Documentation Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Execution status:** Completed on Draft PR #25 at `f84b56a3235b92ea4704eaeed471ca12420cac40`; final verification commit follows this record update.

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

- [x] **Step 1:** Add the system registry and governance rules.
- [x] **Step 2:** Add concise templates for overview, spec, ADR, and TDD documents.
- [x] **Step 3:** Document this documentation system itself and record ADR-0001.
- [x] **Step 4:** Verify all relative links and confirm no template contains unresolved execution placeholders.
- [x] **Step 5:** Commit the governance foundation.

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

- [x] **Step 1:** Write one concise current-state overview per implemented system.
- [x] **Step 2:** Mark exact package and Save ownership without copying full milestone specs.
- [x] **Step 3:** Add Mermaid dependency diagrams only where they materially clarify integration.
- [x] **Step 4:** Cross-check each overview against current source contracts and `WorldSaveV4`.
- [x] **Step 5:** Commit the implemented-system overviews.

### Task 3: Move active RCI design into the system-centric structure

**Files:**
- Create: `docs/systems/rci/README.md`
- Move: `docs/superpowers/specs/2026-08-06-rci-demand-occupancy-foundation-v0-1-design.md` → `docs/systems/rci/specs/2026-08-06-rci-demand-occupancy-foundation-v0-1.md`
- Create: `docs/systems/rci/adrs/0001-citizen-records-as-population-authority.md`

**Interfaces:**
- Consumes: approved RCI design and current Building/Simulation integration.
- Produces: one concise planned-state handoff, one canonical design spec, and one durable authority decision.

- [x] **Step 1:** Relocate the unmerged RCI specification without maintaining a duplicate canonical copy.
- [x] **Step 2:** Add the RCI living overview with status `Approved design — not implemented`.
- [x] **Step 3:** Record citizen records and historical assignments as the population authority in ADR-0001.
- [x] **Step 4:** Verify all links from the RCI overview and PR description.
- [x] **Step 5:** Commit the RCI documentation relocation.

### Task 4: Add planned-system boundary documentation

**Files:**
- Create: `docs/systems/economy/README.md`

**Interfaces:**
- Consumes: current scope exclusions and future RCI extension boundaries.
- Produces: a non-authoritative planned boundary that prevents Economy concerns from leaking into RCI v0.1.

- [x] **Step 1:** State that Economy is planned and has no authoritative runtime state.
- [x] **Step 2:** Define intended responsibilities and expected dependencies without locking formulas.
- [x] **Step 3:** List decisions intentionally deferred.
- [x] **Step 4:** Commit the planned boundary.

### Task 5: Add migration guidance and repository entry points

**Files:**
- Create: `docs/superpowers/README.md`
- Modify: `README.md`
- Modify: Draft PR #25 description

**Interfaces:**
- Consumes: the new system registry and existing legacy artifacts.
- Produces: clear navigation from the repository root and an explicit phased-migration policy.

- [x] **Step 1:** Explain that `docs/superpowers/` is a legacy workflow archive and that new artifacts are system-centric.
- [x] **Step 2:** Update the repository README to link to `docs/systems/README.md` and current milestone status.
- [x] **Step 3:** Update PR #25 to describe both RCI design and the living documentation foundation.
- [x] **Step 4:** Verify the branch diff contains documentation only and no duplicate RCI spec.
- [x] **Step 5:** Commit and review the final documentation tree.

## Verification Checklist

- [x] `docs/systems/README.md` lists every created system and its truthful status.
- [x] Every system README includes purpose, ownership, authority, integrations, persistence, invariants, limitations, and related documents.
- [x] RCI has exactly one canonical full design specification.
- [x] New documentation artifacts are grouped by owning system.
- [x] Planned Economy content is clearly marked unimplemented.
- [x] Legacy navigation explains phased migration and does not claim legacy paths are canonical for new work.
- [x] No unresolved execution placeholder remains in living documents or specifications; angle-bracket prompts are confined to reusable templates.
- [x] Repository-relative links introduced by this foundation resolve to files present on the branch; key legacy targets were checked through the GitHub connector.
- [x] PR #25 remains documentation-only and Draft until the RCI written specification is approved.

## Verification Notes

- GitHub compare and changed-file inspection confirmed Markdown-only changes relative to `master`.
- The moved RCI specification retains blob SHA `ba01f1e661ca4c1b0819f928e8188ec4cdb5c7f0`; the former branch-only path no longer exists.
- Temporary migration paths are absent from the final tree.
- The environment could not clone GitHub through the local container because DNS resolution was unavailable, so link and tree verification used the connected GitHub API rather than a local Markdown-link checker.
