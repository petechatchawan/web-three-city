# Natural World Architecture v1 Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close NW0 by promoting the approved Natural World Architecture v1 decisions into canonical repository documentation without changing Terrain runtime behavior or prematurely implementing Ground, Water, Environment, or Vegetation.

**Architecture:** Keep Terrain Engine v1 production closed and record Natural World v1 as a repository-wide downstream architecture contract. Canonical documentation defines separate Ground, Water, Environment, and Vegetation ownership plus acyclic read dependencies; every runtime NW milestone remains a separately specified and planned subsystem.

**Tech Stack:** Markdown architecture documentation, existing repository architecture verification, Prettier, pnpm workspace CI.

**Spec:** `docs/superpowers/specs/2026-08-31-natural-world-architecture-v1-design.md`

## Global Constraints

- Terrain Engine v1 remains production closed.
- Do not change `systems/terrain/**` runtime code or Terrain public contracts in NW0.
- World remains spatial/map foundation and must not become a natural-world mega-state.
- Ground, Water, and Vegetation are separate canonical owners; Environment classifications are derived in v1.
- Direct system read dependencies must remain acyclic.
- A system must not import another system's `./commands` or `./composition` surface.
- Water must not mutate Terrain directly; erosion that changes Terrain requires explicit orchestration.
- The existing TerrainChangeSet remains Terrain-only and is the coordinate-level invalidation seed.
- Terrain Seed64 compatibility remains unchanged.
- NW1-NW7 are not implemented by this plan.
- Each NW runtime milestone requires its own focused spec and implementation plan before runtime work begins.

---

### Task 1: Canonicalize the approved architecture record

**Files:**
- Verify: `docs/architecture/NATURAL-WORLD-ARCHITECTURE-V1.md`
- Reference: `docs/superpowers/specs/2026-08-31-natural-world-architecture-v1-design.md`
- Reference: `docs/architecture/PRODUCT-ARCHITECTURE.md`
- Reference: `docs/architecture/adr/ADR-001-cross-system-communication-and-ownership-boundary.md`
- Reference: `docs/systems/terrain/specs/TERRAIN-MUTATION-CONTRACT.md`

**Interfaces:**
- Consumes: approved design decisions and existing Product Architecture / ADR-001 / Terrain mutation constraints.
- Produces: one `FROZEN — OWNER APPROVED 2026-08-31` canonical Natural World v1 architecture record.

- [ ] **Step 1: Verify the canonical header and authority references**

Confirm the canonical file begins with:

```markdown
# Natural World Architecture v1

- **Status:** FROZEN — OWNER APPROVED 2026-08-31
```

Confirm it references the approved design and the Terrain closure baseline.

- [ ] **Step 2: Verify the ownership matrix encoded by the document**

The document must unambiguously preserve:

```text
World        = spatial/map foundation
Terrain      = land geometry/elevation authority
Ground       = soil/ground authority
Water        = water/hydrology authority
Environment  = derived shoreline/coastline/environment classification
Vegetation   = gameplay vegetation authority
```

Reject the closure if any paragraph assigns the same canonical concept to two owners.

- [ ] **Step 3: Verify the dependency graph is acyclic**

The canonical direct-read graph must remain:

```text
Terrain      -> World
Ground       -> World + Terrain
Water        -> World + Terrain + Ground
Environment  -> World + Terrain + Ground + Water
Vegetation   -> World + Terrain + Ground + Water + Environment
```

Do not add `Ground -> Water` in v1.

- [ ] **Step 4: Verify Terrain remains closed**

Confirm the canonical record explicitly forbids:

```text
natural-world deep imports into Terrain internals
second elevation authority
Water mutating Terrain directly
Water/Soil/Shoreline/Vegetation semantics inside TerrainChangeSet
Terrain Seed64 behavior changes
```

- [ ] **Step 5: Run formatting verification**

Run:

```bash
pnpm exec prettier --check docs/architecture/NATURAL-WORLD-ARCHITECTURE-V1.md docs/superpowers/specs/2026-08-31-natural-world-architecture-v1-design.md
```

Expected: both files pass Prettier check.

- [ ] **Step 6: Commit only if verification requires a correction**

If corrections are necessary, commit only documentation changes:

```bash
git add docs/architecture/NATURAL-WORLD-ARCHITECTURE-V1.md docs/superpowers/specs/2026-08-31-natural-world-architecture-v1-design.md
git commit -m "docs(architecture): finalize natural world architecture v1"
```

If no correction is required, do not create an empty commit.

---

### Task 2: Close NW0 without creating runtime packages

**Files:**
- Verify: `systems/`
- Verify: `docs/architecture/NATURAL-WORLD-ARCHITECTURE-V1.md`
- Verify: PR diff against `master`

**Interfaces:**
- Consumes: the canonical Natural World v1 architecture record.
- Produces: an NW0 closure diff containing documentation only.

- [ ] **Step 1: Confirm no new runtime natural-world package exists**

At NW0 completion, the active production systems remain the already-existing packages plus no newly implemented `ground`, `water`, `environment`, or `vegetation` runtime package from this PR.

- [ ] **Step 2: Confirm no Terrain runtime file changed**

Run:

```bash
git diff --name-only master...HEAD
```

Expected: no path under:

```text
systems/terrain/
apps/game/src/composition/systems/terrain-*
```

is modified by NW0.

- [ ] **Step 3: Run architecture verification**

Run the repository architecture command defined by the root package scripts.

Expected: all architecture enforcement checks pass; no new cycle or forbidden cross-system import exists.

- [ ] **Step 4: Run repository CI-equivalent verification for the docs-only diff**

Run the root CI commands used by `.github/workflows/ci.yml` without weakening any check.

Expected: formatting, type/lint/test/architecture checks required by CI all pass.

- [ ] **Step 5: Record the final NW0 diff**

Run:

```bash
git diff --stat master...HEAD
git diff --name-only master...HEAD
```

Expected: documentation-only changes related to Natural World v1 closure and its plan.

---

### Task 3: Promote PR #117 from design review to architecture closure

**Files:**
- PR metadata only; no runtime file changes.

**Interfaces:**
- Consumes: owner approval plus passing final-head verification.
- Produces: a ready-for-review, mergeable Natural World v1 architecture closure PR.

- [ ] **Step 1: Update PR summary**

The PR body must state that owner approval was received on 2026-08-31 and that `docs/architecture/NATURAL-WORLD-ARCHITECTURE-V1.md` is the canonical frozen authority.

- [ ] **Step 2: Mark the PR ready for review**

Do not leave the PR in Draft after the owner-approved frozen record exists.

- [ ] **Step 3: Verify checks on the exact final head SHA**

Required closure evidence:

```text
CI conclusion = success
architecture checks = pass as part of CI
no unresolved required review blocker
```

Do not use a successful run from an older head SHA as final evidence.

- [ ] **Step 4: Merge with expected head SHA**

Merge only the verified exact final head to `master` using the repository's normal merge method and expected-head protection.

- [ ] **Step 5: Verify post-merge master**

Confirm `master` contains the frozen canonical record and that the post-merge required CI run succeeds before declaring NW0 closed.

---

### Task 4: Freeze milestone decomposition for subsequent work

**Files:**
- Verify: `docs/architecture/NATURAL-WORLD-ARCHITECTURE-V1.md`
- Future specs/plans are created only when their milestone begins.

**Interfaces:**
- Consumes: closed NW0 architecture.
- Produces: an explicit handoff boundary preventing one giant Natural World implementation.

- [ ] **Step 1: Preserve the frozen milestone order**

```text
NW0  Natural World Architecture closure
 ↓
Terraform v1
 ↓
NW1  Ground Foundation
 ↓
NW2  Water / Hydrology Foundation
 ↓
NW3  Environment + Shoreline
 ↓
NW4  Vegetation Foundation
 ↓
NW5  Natural-world reconciliation
 ↓
NW6  Full procedural natural-world generation
 ↓
NW7  Authored / Hybrid map contracts
 ↓
Map Editor
```

- [ ] **Step 2: Require separate design gates for NW1-NW7**

Before runtime work for each milestone, create a focused owner-approved design that defines at minimum:

```text
Purpose
Canonical Authority / Derived State
Commands
Queries
Integration Events where justified
Persistence ownership
Generation/source semantics where applicable
External read dependencies
Presentation ownership
Testing boundary
Failure/rejection semantics
```

- [ ] **Step 3: Do not create empty package scaffolding early**

No `systems/ground`, `systems/water`, `systems/environment`, or `systems/vegetation` package is created until its focused milestone design is approved and implementation begins.

- [ ] **Step 4: Hand off to Terraform v1 design freeze**

After NW0 is merged and post-merge verified, resume the previously planned Terraform v1 Product Design Freeze against the existing Terrain public contracts. Natural-world runtime implementation is not a prerequisite for that Terraform design/implementation milestone.

---

## Plan Self-Review Result

Spec coverage for NW0:

```text
ownership boundaries                     covered by Task 1
acyclic dependency direction             covered by Task 1
Terrain production closure preservation  covered by Tasks 1-2
TerrainChangeSet boundary                covered by Task 1
no premature runtime implementation      covered by Task 2
owner-approved canonicalization          covered by Task 3
future milestone decomposition           covered by Task 4
Terraform-before-NW1 ordering            covered by Task 4
```

No NW1-NW7 runtime algorithm is intentionally included in this plan. Those are independent subsystem milestones and require separate specs/plans.
