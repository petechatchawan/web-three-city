# Architecture and Infrastructure Upgrade v0.1 Closure Implementation Plan

> **For agentic workers:** Execute this plan inline. Do not dispatch subagents. Track each checkbox and preserve one logical final commit.

**Goal:** Publish the authoritative v0.1 closure record through a docs-only PR after independently verifying PR5 merge integrity.

**Architecture:** One verification record owns final evidence. Existing README/spec/TDD documents receive only minimal status, checklist, and link updates; the historical Phase 1 baseline remains byte-for-byte unchanged.

**Tech Stack:** Markdown, Git, GitHub CLI, GitHub Actions metadata and logs.

## Global Constraints

- Branch: `docs/architecture-infrastructure-v0-1-closure`.
- Allowed diff: `docs/systems/architecture-infrastructure/**` only.
- Do not rerun browser tests unless a required check blocks merge.
- Merge with one logical commit and verify the resulting `master` SHA before deleting the branch.

### Task 1: Verify immutable PR5 evidence

**Files:** Read GitHub metadata/logs only.

- [ ] Confirm PR #42 is merged and record PR1–PR5 identities.
- [ ] Confirm candidate, merge-ref, and squash-merged tree equality through GitHub Git data.
- [ ] Confirm CI run/job timestamps, Game/browser inventories, workers, artifact identity, and CI step topology from logs.

### Task 2: Write the closure documentation

**Files:**

- Create: `docs/systems/architecture-infrastructure/verification/2026-08-08-architecture-infrastructure-v0-1-closure.md`
- Modify: `docs/systems/architecture-infrastructure/README.md`
- Modify: `docs/systems/architecture-infrastructure/specs/2026-08-07-architecture-infrastructure-upgrade-v0-1.md`
- Modify: `docs/systems/architecture-infrastructure/tdd/2026-08-07-architecture-infrastructure-upgrade-v0-1.md`

- [ ] Write the authoritative record using only verified values, including before/after measurements and non-blocking debt.
- [ ] Mark the README milestone `CLOSED / PASS` and replace pending closure language with a final-record link.
- [ ] Add only completion status/link updates to the approved specification and original TDD plan.
- [ ] Prove the Phase 1 baseline has no diff.

### Task 3: Verify and publish the docs-only PR

**Files:** All changed documentation files.

- [ ] Check Markdown whitespace, relative links, evidence consistency, status consistency, and placeholders.
- [ ] Enforce the path allowlist and inspect the exact diff against `origin/master`.
- [ ] Commit all closure documentation as one logical commit, push the named branch, and open a docs-only PR with the verification exception stated explicitly.
- [ ] Confirm no required check forces browser execution; merge the PR when mergeable.
- [ ] Verify the final remote `master` SHA contains the reviewed documentation tree, then delete local and remote closure branches.
