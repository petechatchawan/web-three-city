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
node --test tooling/verify-affected.test.mjs → 5/5 PASS
node --test tooling/ci-topology.test.mjs → 18/18 PASS
pnpm test:deployment → 88/88 PASS
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

## CI-R5 measurement boundary

Hosted wall-clock and runner-minute measurements are intentionally deferred to
the exact-head GitHub run. Local discovery proves shard coverage but cannot
prove GitHub scheduling or runner-minute cost. The rollback command remains
`pnpm verify:full`, and the workflow can be returned to the previous serial
Browser job if hosted evidence shows unacceptable imbalance or artifact risk.
