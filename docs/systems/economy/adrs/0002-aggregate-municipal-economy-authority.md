# ADR 0002 — Aggregate Municipal Economy Authority

**Status:** Accepted for Economy Foundation v0.1

## Context

The game needs a real municipal loop without prematurely modeling household or business finance. Existing RCI, Building, Road, and Simulation packages already own the source state from which economic activity is derived.

## Decision

Create framework-independent `economy-core` as the sole authority for treasury, R/C/I tax policy, aggregate accounting periods, settlement markers, rules, quotes, and Economy validation. Application orchestration supplies immutable taxable-activity and road-maintenance projections. Occupied dwellings and occupied channel-specific workplace positions are the v0.1 taxable bases.

Economy stores no citizens, employment, buildings, roads, demand, or calendar copies. Balance constants live in a versioned `EconomyRulesV1` asset.

## Consequences

- Package ownership stays acyclic and deterministic.
- Revenue is intentionally coarse but compatible with current RCI authority.
- Future services can add categorized expense projections without changing Treasury ownership.
- Personal and business economics require a later explicit design.

## Rejected Alternatives

- Put money in World/application state: obscures domain authority and validation.
- Make RCI or Building calculate tax: couples policy to source systems and risks cycles.
- Begin with per-agent wallets and firms: scope and persistence cost exceed the foundation gameplay loop.

## Enforcement

Package dependency tests, Economy projection contracts, snapshot validation, and the repository architecture boundary suite.
