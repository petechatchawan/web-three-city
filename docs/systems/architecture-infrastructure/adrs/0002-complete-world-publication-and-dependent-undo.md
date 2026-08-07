# ADR-0002: Publish Complete Worlds and Restore Dependent State Together

**Status:** Accepted  
**Date:** `2026-08-07`  
**System:** `architecture-infrastructure`

## Context

`GameWorldStateStore` currently atomically publishes Simulation, Buildings, and RCI, while Terrain, Water, Roads, and Zones remain outside the store. Building bulldoze changes Building authority without immediate RCI inventory reconciliation. Building Undo restores only a Building snapshot even though RCI Dwelling and Workplace inventory can be retired by the change.

Save encoding reads the current application locals, and Load validates cross-system references. This means a mutation can appear committed to one domain while producing a Save that another domain correctly rejects. Future systems will make this inconsistency more costly.

## Decision

Define the application publication boundary as a complete committed world containing Terrain, derived Water, Roads, Zones, Buildings, Simulation, RCI, and the derived environments required to validate and present them.

Every cross-system mutation follows:

```text
capture committed world
-> plan domain changes
-> reconcile dependent state
-> validate before/after revisions and invariants
-> publish one next committed world
-> rebuild or synchronize derived presentation
```

Save reads only the committed world. Undo restores a complete dependent-world state or executes a deterministic reverse command that recreates all dependent projections, inventories, assignments, and references. Restoring one snapshot while leaving dependent state stale is prohibited.

The existing Save wire schema remains unchanged in this program. V3-V4 migration may deterministically reconstruct derived workplace inventory from persisted active Buildings and the decoded world Simulation state before returning the decoded world. V3 uses its deterministic synthesized Simulation snapshot because its wire format has no Simulation; V4 decodes Simulation from Save. V1-V2 contain no persisted Buildings and must return empty Building-linked inventory without inventing state. This is an accepted compatibility repair, not a new persisted authority. Any persisted-field or version change requires a new ADR and separate approval.

## Consequences

### Positive

- Immediate Save cannot observe a partially reconciled Building/RCI state.
- Undo has explicit semantics for dependent state rather than relying on a later tick.
- Revision fencing covers all participating domains.
- Presentation can be rebuilt from one committed source.
- Economy and future authoritative systems have a clear integration requirement.

### Negative

- Complete-world composition increases the amount of application coordination that must be tested.
- Some current domain-local mutation paths need adapters before they can publish through the new boundary.
- Undo storage or reverse commands may carry more data than the current one-domain snapshot.
- Rollback and failure tests must cover both authority and presentation recovery.

## Alternatives Considered

### Keep the partial store and reconcile on the next tick

Rejected. Save, UI, and Undo can occur between mutation and the next tick; this creates observable stale state and invalid Save risk.

### Let each domain own its own Undo and Save repair

Rejected. Cross-domain references and migration ordering would remain duplicated and could disagree.

### Store only a generic event history

Rejected. Events alone do not guarantee deterministic reverse behavior, complete dependent state, or compatibility with existing snapshots.

## Enforcement

- Characterization tests cover Building bulldoze -> immediate Save -> Load and Building bulldoze -> tick -> Undo.
- `commitRciTick` rejects stale or mismatched Building after-state contracts.
- Publication tests assert one revision increment and no partial replacement on failure.
- Save/Load tests compare continuous and resumed execution from the same committed state.
- Presentation coordinator tests consume only committed snapshots.
- Level 2 owner plus `game` verification applies to Save-facing and exported contract changes.

## Supersession

If a future event-sourced or transactional storage design replaces this boundary, it must retain complete dependent-state validation and deterministic Save/Undo equivalence. Add a superseding ADR rather than weakening this decision implicitly.
