# Browser Verification Policy v0.2

**Status:** Approved  
**System:** Development Workflow  
**Date:** 2026-08-17

## Problem

The unfiltered Chromium browser suite is a high-cost release regression surface. On PR #79 it contains 144 tests and a representative CI run took roughly 31 minutes with one worker. Re-running that suite after small fixes turned Full Browser into a debugger rather than a release gate, producing slow feedback without materially improving root-cause isolation.

The repository already has the right primitives—package-scoped tests, targeted Playwright tags, Lean CI, a conditional `full-ci` browser job, and `pnpm verify:full`—but the normative Level 4 wording still makes browser-visible PR finalization collapse too easily into the full suite.

## Decision

Use the smallest sufficient verification loop during implementation and make browser scope proportional to affected behavior.

### Mandatory PR verification

1. **Level 0–2:** focused owner and affected-consumer tests/typechecks selected from `AGENTS.md`.
2. **Level 3:** `pnpm verify` / Lean CI when repository, tooling, workspace, CI, or other Level 3 triggers apply.
3. **Browser-observable changes:** run targeted Playwright specs/tags that cover the affected behavior. This evidence is required before the PR is ready when browser behavior changed.
4. **Manual visual acceptance:** remains required when the owning milestone explicitly requires owner visual acceptance.

Targeted browser verification is an affected-behavior gate, not full release evidence.

### Full Browser escalation

The unfiltered Full Browser suite is **not a default gate for every PR**. It is required only when one of these conditions applies:

- milestone or production release closure explicitly requires full browser regression evidence;
- shared browser infrastructure/configuration changes make targeted ownership insufficient (for example Playwright project topology, global browser harness, shared navigation/input/modal infrastructure, or test-discovery authority);
- the PR is explicitly labeled `full-ci` for conservative escalation;
- a maintainer manually dispatches the workflow;
- the scheduled nightly regression run executes.

Uncertainty alone should first expand targeted affected subsets. Escalate to Full Browser only when the impact boundary cannot be bounded with reasonable confidence.

### CI topology

- **Lean CI** remains the mandatory PR CI owner and runs `pnpm check`.
- **Full Browser CI** remains dependent on Lean artifacts and does not repeat Lean-owned verification.
- Pull requests run Full Browser only when labeled `full-ci`.
- Manual `workflow_dispatch` runs Full Browser.
- A nightly scheduled run executes the full browser authority off the default branch so broad regression coverage is retained without blocking every PR.
- `pnpm verify:full` remains the canonical local/manual full-release command.

### PR evidence

PRs that change browser-observable behavior must record:

- the affected Playwright command(s) or spec(s) executed;
- pass/fail result for those targeted tests;
- whether Full Browser escalation is required and why;
- exact-head evidence when the selected final gate requires it.

The PR template should make targeted browser evidence and Full Browser escalation explicit rather than representing all browser verification as one undifferentiated checkbox.

## PR #79 application

Citizen Mobility & Traffic PR #79 will use this policy immediately:

- Lean CI / `pnpm check` is mandatory.
- Citizen Mobility/Traffic browser acceptance is verified with the affected commute, Save/Load, recovery, performance, mobile viewport, locale/modal, and Growth regression specs.
- Sonar remains required by the PR's existing release contract.
- owner manual visual acceptance at 414×896 remains required.
- the 144-test Full Browser suite is not required to iterate or close PR #79 unless the change expands into shared browser infrastructure or a maintainer explicitly requests release-wide regression evidence.

## Non-goals

- no automatic changed-file-to-Playwright-tag graph in v0.2;
- no broad Playwright worker/retry/timeout changes;
- no removal of Full Browser or `verify:full`;
- no weakening of deterministic domain, Save compatibility, Sonar, or owner visual acceptance gates;
- no gameplay/runtime behavior change.

## Acceptance criteria

- Repository policy states that targeted browser verification is mandatory for browser-observable changes.
- Level 4 no longer implies Full Browser for every browser-visible PR.
- Full Browser remains available through `full-ci`, manual dispatch, nightly schedule, and `verify:full`.
- CI topology tests protect the conditional PR behavior and scheduled full-regression path.
- PR template distinguishes targeted browser evidence from Full Browser escalation.
- Development Workflow living documentation reflects the new policy.
