# Lean CI Design

## Status

Accepted for Inline Execution on 2026-08-01.

## Context

`web-three-city` is a private repository. The previous pull-request workflow installed dependencies independently in four jobs and ran Chromium on every relevant update. GitHub Actions was later disabled to avoid unnecessary private-repository minute consumption. Pull requests still work without CI, but regressions are no longer checked automatically.

## Goal

Restore automated pull-request verification while minimizing billed GitHub-hosted runner minutes.

## Non-goals

- Do not change repository visibility.
- Do not restore automated Vercel deployment.
- Do not run Playwright on every pull-request update.
- Do not configure branch protection or required checks in this change.
- Do not change application, package, test, or build behavior.

## Workflow architecture

Create one workflow at `.github/workflows/ci.yml` with two jobs.

### Lean CI

The default pull-request job runs on one `ubuntu-latest` runner and executes the existing canonical repository command:

```text
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` remains authoritative and covers formatting, linting, TypeScript checks, provenance checks, unit tests, deployment-contract tests, and the full workspace build. Combining these checks into one job avoids repeating checkout, dependency installation, cache restore, and runner startup across multiple jobs.

### Full browser verification

Playwright runs only when one of these conditions is true:

1. A pull request has the `full-ci` label.
2. The workflow is started manually with `workflow_dispatch`.

The browser job builds both browser applications, installs Chromium with system dependencies, runs `pnpm test:browser`, and uploads Playwright evidence even when the test fails.

When `full-ci` remains on a pull request, a later commit must run browser verification against the new head. Applying the label triggers browser verification immediately without rerunning Lean CI solely because of the label event.

## Triggers and minute controls

- Pull-request actions: `opened`, `synchronize`, `reopened`, and `labeled`.
- Ignore pull requests that change only `docs/**` or Markdown files.
- Manual execution remains available through `workflow_dispatch`.
- Use workflow-level concurrency grouped by workflow and ref.
- Set `cancel-in-progress: true` so a newer commit cancels the obsolete run.
- Use read-only repository permissions.
- Set explicit job timeouts.
- Use pnpm caching through `actions/setup-node`.

## Exact environment

- Runner: `ubuntu-latest`
- Node.js: `22`
- pnpm: `10.13.1`
- Checkout: `actions/checkout@v4`
- Node setup: `actions/setup-node@v4`
- pnpm setup: `pnpm/action-setup@v4`

## Failure behavior

- A Lean CI command failure fails the Lean CI job immediately.
- A browser failure fails Full browser verification and retains `playwright-report` and `test-results` artifacts when present.
- A label event unrelated to `full-ci` produces no expensive job.
- A documentation-only pull request produces no automatic workflow run.

## Acceptance criteria

1. A pull request changing `.github/workflows/ci.yml` starts Lean CI.
2. Lean CI executes `pnpm check` successfully on the exact pull-request head.
3. The workflow uses only one default runner job for quality, tests, and build.
4. Playwright is absent from the default Lean CI job.
5. Full browser verification is callable manually and through `full-ci`.
6. Obsolete runs are cancelled when a newer commit is pushed.
7. No deployment workflow or repository visibility setting is changed.
