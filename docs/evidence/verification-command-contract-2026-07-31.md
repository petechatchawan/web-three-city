# Verification Command Contract Evidence — 2026-07-31

## Scope

This evidence covers the repository-owned `pnpm verify` and `pnpm verify:full` command contracts introduced on PR #11. It does not claim that the complete project dependency graph, Vitest suite, Vite builds, or Playwright suite passed for the current Road Network head.

## Exact source

- Branch: `agent/road-network-foundation-v0-1`
- Verified PR head after implementation: `545478654390d1b33a3cd412dda3557da410f1e7`

## Commands added

```bash
pnpm verify
pnpm verify:full
```

`pnpm verify` delegates to `pnpm check`.

`pnpm verify:full` performs:

```text
pnpm install --frozen-lockfile
pnpm verify
pnpm exec playwright install chromium
pnpm test:browser:only
node tooling/verify-clean-worktree.mjs
```

## TDD evidence

Initial contract tests were run before implementation and failed 5/5 because the scripts and clean-worktree verifier were absent.

After implementation, the pushed file contents were fetched back from GitHub. Their calculated Git blob SHAs matched the remote blob SHAs:

```text
d22fa7c441110c68ebccffabd61df34b4f77338e  package.json
b9d1bed5807b6cffdd697b06089d479273fd3cb9  tooling/verification-scripts.test.mjs
2e6038f2ab441aa92edc38ef022dbfaab7e98e57  tooling/verify-clean-worktree.test.mjs
bbd0eb452d94bb4f0255f762be572a8ca4b13cc7  tooling/verify-clean-worktree.mjs
```

Fresh built-in Node test result:

```text
5 tests
5 passed
0 failed
```

The command-shell sequence was also executed against the exact pushed `package.json` using a deterministic pnpm command spy. The observed order was:

```text
pnpm check
pnpm install --frozen-lockfile
pnpm verify
pnpm exec playwright install chromium
pnpm test:browser:only
```

The final clean-worktree verifier passed from a clean committed Git repository and its negative test rejected dirty tracked changes.

## Environment limitation

The chat execution environment cannot download pnpm 10.13.1 or repository dependencies because outbound registry access is blocked. Chromium navigation to local HTTP and file URLs is also blocked by administrator policy. Therefore the current exact-head full commands remain to be run from a local or other execution environment containing the complete source checkout and package cache/network access before release promotion to `master`.
