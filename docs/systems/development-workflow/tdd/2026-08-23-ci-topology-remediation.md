# CI Topology Remediation TDD Record

## CI-R1 RED

Added topology assertions requiring the existing PR-T4 affected plan to fan out into `plan`, `lint`, `tests`, `consumers`, `typecheck`, `deployment`, and `browser_build` lanes, with `lean` as an aggregate and `browser` depending only on `browser_build`.

Command:

```bash
node --test tooling/ci-topology.test.mjs
```

Result: RED, 15 passed and 2 failed for the intended missing workflow topology:

- missing `plan` job and non-browser fan-out lanes;
- Browser still had `needs: lean` and an unconditional pull-request condition.

No syntax, fixture, or test-infrastructure failure was involved.

## CI-R1 Baseline

Before the new assertions:

- topology/resolver/script contracts: 36/36 PASS;
- deployment verification: 81/81 PASS;
- current exact Browser inventory: preserved by existing topology tests;
- current workflow: serial `lean` (`pnpm check`) followed by Browser.

## CI-R2/R3 GREEN — affected fan-out and exact Browser artifact

The existing `verify-affected` path now supports:

- `--plan-only` to publish one exact-head plan without running commands;
- `--plan-file` so every lane consumes the published plan rather than
  recomputing changed files;
- `--lane lint|owner-tests|consumer-tests|typecheck|deployment|browser` to
  select only the command kind owned by that lane;
- changed-file Prettier/ESLint commands through the existing safe argument-array
  command runner.

The workflow now fans out `lint`, `tests`, `consumers`, `typecheck`,
`deployment`, and `browser_build` directly from `plan`. `lean` aggregates the
non-browser lane status. Browser consumes only the exact artifact from
`browser_build` and no longer waits for `lean`.

Focused command results:

```text
node --test tooling/verification-command-runner.test.mjs → 6/6 PASS
node --test tooling/verify-affected.test.mjs → 9/9 PASS
node --test tooling/ci-topology.test.mjs → 21/21 PASS
pnpm test:deployment → 96/96 PASS
```

## CI-R4 GREEN — Full Browser two-shard pilot

Full Browser is now a separate matrix job with exactly two spec shards,
`--shard=1/2` and `--shard=2/2`, each explicitly using `--workers=1` and
`fail-fast: false`. Both shards consume the same exact `browser-builds`
artifact. The targeted Browser job remains separate and is selected only for
targeted mode.

Local Playwright discovery evidence:

```text
serial baseline: 137 tests / 33 files
shard 1:         71 tests
shard 2:         66 tests
union:           137 tests
overlap:         0
missing:         0
extra:           0
```

No Full Browser assertions, retries, workers, or timeouts were weakened.

## CI-R5/CI-R6 hosted verification

The exact-head hosted run was `32636726238` on
`f4fe58e64f3afc93e3e9007c679579cbba7385d8`. Classification, changed-file lint,
owner tests, consumer tests, typechecks, deployment contracts, Lean aggregation,
and the Browser build artifact all passed. Sonar Quality Gate passed. Browser
verification ran as two independent Full Browser shards with 71 and 66 passing
tests; the wall-clock duration was 14m25s and the aggregate active shard time was
26m10s. Browser artifacts were `9492677283` and `9492663494`.

Third-party workflow actions are pinned to immutable commit SHAs and each CI job
declares least-privilege `contents: read` permissions. The rollback command remains
`pnpm verify:full`; no retry, worker, timeout, assertion, or gameplay behavior was
changed.

## CI-R6 lane-isolation correction

The first manual-dispatch attempt on the documentation candidate exposed a
lane-isolation defect: a plan with browser-required authority but no ownership
tags was rejected while a non-browser lane was running with `--skip-browser`.
The focused regression was RED for that intended failure, then GREEN after the
command runner began omitting browser command construction whenever the
selected lane excludes Browser. Browser authority remains validated and
executed by the dedicated Browser lanes.

Final focused command-runner evidence is `7/7 PASS`; the repository deployment
contract suite is `97/97 PASS` after this correction.
