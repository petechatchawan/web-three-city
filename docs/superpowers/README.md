# Legacy Superpowers Documentation Archive

`docs/superpowers/` contains specifications, plans, evidence, and verification artifacts created before the repository adopted system-centric documentation.

## Canonical policy

New documentation belongs under:

```text
docs/systems/<system>/README.md
docs/systems/<system>/specs/
docs/systems/<system>/adrs/
docs/systems/<system>/tdd/
docs/systems/<system>/verification/
```

Start navigation at [`docs/systems/README.md`](../systems/README.md).

## Migration policy

- Existing files remain readable until classified and migrated.
- Do not copy a full document into both layouts.
- When a file moves, update repository-relative links and remove the old canonical copy or leave a short redirect when external references require it.
- Preserve dates, approval status, authorship context, and Git history.
- Cross-system documents choose one owning system and link from other relevant overviews.
- New plans use the owning system's `tdd/` directory even when generated with Superpowers workflows.

## Current migration state

- The active RCI Demand & Occupancy design in Draft PR #25 is canonical under `docs/systems/rci/specs/`.
- Older Terrain, Road, Zoning, Building, deployment, evidence, and verification artifacts remain in this archive pending phased migration.
- Living current-state handoffs already exist under `docs/systems/` and link back to relevant legacy records where useful.

This directory is not deprecated as history; it is deprecated as the default location for new system artifacts.
