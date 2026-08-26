# Selective Verification vNext — Ownership Precision

**Status:** Approved direction; implementation plan for the post-PR-T6 ownership-precision phase
**System:** Development Workflow
**Relation:** follows PR-T6 CI Topology Remediation; does not redesign its execution graph

## Purpose

Make selective verification precise for every system. A normal pull request
must verify the changed authority and its affected consumers, then run only
the Browser ownership tags required by the changed browser-observable
authority. Full Browser remains an explicit shared/global or release
backstop, not the default for ordinary system changes.

## Canonical flow

```text
changed files
  → authority + ownership resolution
  → owner tests
  → affected consumers
  → typecheck / lint / deployment
  → targeted Browser only when browser-observable authority is affected
```

`AGENTS.md` Level 0–4 remains the only verification-level authority.
`GRAPH_SAFE`, `PARTIAL`, `GRAPH_BLIND`, and `GLOBAL` remain resolver risk
signals.

## Browser ownership baseline

| Authority | Browser tag |
| --- | --- |
| Terrain presentation | `@terrain` |
| Water presentation | `@water` |
| Road presentation | `@road` |
| Zoning presentation | `@zoning` |
| Building/Growth presentation | `@building` |
| Economy/RCI UI | `@rci` |
| Traffic presentation | `@traffic` |
| Camera/input interaction | `@interaction` |

Direct deterministic changes in `economy-core`, `simulation-core`,
`citizen-mobility-core`, and `traffic-core` remain Browser `none` unless the
changed authority itself crosses a browser boundary.

## `apps/game` precision rules

`apps/game/**` must not map to every Browser tag. Rules are path- and
authority-aware:

| Changed path/example | Authority | Browser result |
| --- | --- | --- |
| `apps/game/src/traffic-transport-transaction.ts` | deterministic application | `none` |
| `apps/game/src/traffic-presentation.ts` | Traffic presentation | targeted `@traffic` |
| `apps/game/src/terraform-water-projection.ts` | Water presentation | targeted `@water` |
| `apps/game/src/zone-building-presentation.ts` | Zoning + Building presentation | targeted `@building|@zoning` |
| `apps/game/src/game-bootstrap.ts` | unbounded composition | `GRAPH_BLIND` + Full Browser |

Changed deterministic tests remain below Browser even when they are located
under `apps/game`.

## Escalation

- Bounded system presentation → exact targeted ownership-tag union,
  `fullBrowserRequired: false`.
- Deterministic-only source/test → Browser `none`.
- Unknown ownership or unbounded shared composition → fail closed; do not skip
  Browser evidence.
- Shared CI/browser infrastructure, explicit `full-ci`, manual dispatch,
  nightly, release, or equivalent unbounded authority → Full Browser.

Full Browser remains the complete 137-test Chromium inventory. Targeted
Browser is affected authority evidence, not release-wide evidence.

## Non-goals

- No CI workflow/topology redesign.
- No Playwright assertion migration or deletion.
- No worker, retry, timeout, or shard-policy change.
- No gameplay, Save, or package-boundary change.
- No Economy/RCI, Growth, Zoning, Building, Water, Terrain, Road, or Traffic
  test migration in this phase.
