# Temporal Authority Delivery — Execution Index

## Execution order

1. **Phase 1 — PR #83 clock freeze and atomic minute**
   Execute: [2026-08-25-pr83-clock-freeze-atomic-minute.md](./2026-08-25-pr83-clock-freeze-atomic-minute.md)
   Authorization: approved for Luna Max implementation.
   Stop after exact-head verification and Owner Visual handoff; do not start Phase 2 automatically.
2. **Phase 2 — explicit temporal units and WorldSaveV9**
   Plan: [2026-08-25-explicit-temporal-units-world-save-v9.md](./2026-08-25-explicit-temporal-units-world-save-v9.md)
   Authorization: deferred to a dedicated successor delivery.
3. **Phase 3 — compressed calendar and playback migration**
   Plan: [2026-08-25-calendar-playback-migration.md](./2026-08-25-calendar-playback-migration.md)
   Authorization: blocked until ADR 0004 and its balance impact are explicitly approved.

## Luna Max Phase 1 handoff

At session start Luna must inspect and record:

```bash
git status --short --branch
git rev-parse HEAD
git branch --show-current
git log --oneline --decorate -20
git diff --stat
git diff --name-status
```

Expected branch is `feat/motion-junction-realism-v1`. Treat the actual local documentation HEAD as authority after inspection; do not reset to an older SHA.

Preserve without editing, staging, moving, deleting, or committing:

```text
docs/superpowers/plans/2026-08-23-ci-topology-remediation.md
docs/superpowers/plans/2026-08-23-selective-verification-vnext-ownership-precision.md
```

Read before production edits:

- `docs/systems/simulation-time/specs/2026-08-25-temporal-authority-standard-v1.md`
- `docs/systems/simulation-time/adrs/0002-atomic-temporal-minute-publication.md`
- `docs/systems/simulation-time/adrs/0003-explicit-temporal-units.md`
- `docs/systems/simulation-time/adrs/0004-simulation-calendar-playback-standard.md`
- `docs/systems/world/adrs/0001-world-save-v9-temporal-unit-migration.md`
- the Phase 1 TDD plan above

## Phase 1 prohibited work

- Do not disable or bypass Automatic Growth.
- Do not change current calendar ratios or playback rates.
- Do not introduce WorldSaveV9 or rename durable fields.
- Do not change Traffic, Mobility, Road, or Building gameplay semantics.
- Do not weaken fingerprints, validation, revision order, or five-phase cadence.
- Do not expose mutable committed authority.
- Do not push RED, force-push, merge PR #83, or mark Owner Visual PASS.
- Do not start Phase 2 or Phase 3.

## Required workflow

Use strict RED → GREEN per task. Record exact failing test, expected/actual reason, then focused GREEN. Use owner tests before Level 2 consumers, targeted Playwright before repository gates, and `pnpm verify:full` only at final release closure. Keep useful GREEN commits; never commit intentional RED.

The final candidate must be non-force pushed only after local GREEN, diff review, clean tracked worktree, and preservation of both user plans. Verify exact-head GitHub Actions and Sonar. PR #83 remains Draft and unmerged until the human owner reports visual acceptance.
