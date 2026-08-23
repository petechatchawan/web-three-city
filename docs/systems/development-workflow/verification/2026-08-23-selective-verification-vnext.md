# Selective Verification vNext — Ownership Precision Handoff

**Status:** Planned implementation; Owner Acceptance pending after execution
**System:** `development-workflow`

## Scope

This phase makes the existing PR-T6 affected plan precise for every system,
with special attention to `apps/game` application and presentation paths. It
does not alter the PR-T6 CI topology or the Full Browser two-shard authority.

## Required result

```text
deterministic core/application
  → owner + affected consumers + typecheck
  → Browser none

bounded system presentation
  → owner + affected consumers + typecheck
  → targeted Browser ownership tag(s)

unbounded bootstrap/shared/unknown
  → conservative fail-closed escalation
  → Full Browser
```

## System matrix

| System | Direct deterministic owner | Browser authority |
| --- | --- | --- |
| Terrain | `terrain-core` | `@terrain` |
| Water | `water-core` | `@water` |
| Road | `road-core` | `@road` |
| Zoning | `zone-core` | `@zoning` |
| Building/Growth | `building-core` | `@building` |
| Economy/RCI | `economy-core`, `rci-core` | `@rci` only for browser-observable UI |
| Traffic | `traffic-core` | `@traffic` only for presentation |
| Camera/Input | `camera-input` | `@interaction` |
| Simulation/Mobility | `simulation-core`, `citizen-mobility-core` | Browser none for deterministic source |

## `apps/game` audit contract

The implementation must classify concrete application paths rather than use
one broad `apps/game/**` Browser tag list. At minimum it must distinguish:

- Traffic transaction/reconciliation/source projection → deterministic;
- Traffic presentation/information/inspect projection → `@traffic`;
- Water projection → `@water`;
- Zoning + Building presentation → `@zoning|@building`;
- bootstrap/composition with no bounded authority → `GRAPH_BLIND` and Full
  Browser.

The full path table is maintained in the companion specification before code
changes are made.

## Acceptance matrix

```text
Terrain browser source     → targeted @terrain, not Full
Water browser source       → targeted @water, not Full
Road browser source        → targeted @road, not Full
Zoning browser source      → targeted @zoning, not Full
Building browser source    → targeted @building, not Full
RCI browser source         → targeted @rci, not Full
Traffic browser source     → targeted @traffic, not Full
Interaction browser source → targeted @interaction, not Full
deterministic-only core    → Browser none
unknown/shared authority   → fail closed / Full Browser
```

## Verification evidence

Focused resolver RED/GREEN tests must prove exact Browser mode, tags, risk,
owner targets, and Full Browser status. Natural post-topology candidates are
used for hosted canaries; no artificial production change is created just to
measure a tag.

The final candidate must pass the repository tooling gate, affected plan
preview, deployment contracts, exact-head hosted verification, Sonar, and
clean-worktree verification. Full Browser is run only when the candidate's
authority requires escalation.
