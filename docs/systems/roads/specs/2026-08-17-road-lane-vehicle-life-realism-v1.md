# Road Lane & Vehicle Life Realism v1

**Status:** Approved for implementation  
**Baseline:** `master@eaa15d2f72f957c1d31169de2adcf4946f99b70e`  
**Primary systems:** Roads, Traffic, Citizen Mobility, RCI Household, Vehicle Life, Three.js presentation

## Goal

Evolve the current road-and-commute foundation from a single gray centerline road with temporary trip visuals into a believable street-life model with versioned road types, two directional travel lanes, lane-aware Traffic presentation, persistent household-owned vehicles, and deterministic parked/departing/arriving vehicle behavior.

The target is believable city traffic, not a full microscopic traffic simulator.

## Authority hierarchy

```text
RoadSnapshot.definitionCodes
        ↓
Road Definition Catalog
        ↓
Derived Road / Lane Geometry
        ↓
Traffic Graph + Traffic Road Profiles
        ↓
Mobility Trip Planning
        ↓
Vehicle Life Authority
        ↓
Traffic / Parking Presentation
```

Invariants:

- Road mesh is never Road authority.
- Lane mesh is never lane authority.
- Traffic routes never own vehicle identity.
- Traffic trips never equal vehicle existence.
- Parked meshes never own canonical vehicle location.
- Parking anchors are presentation-only derivations.

## Road Definition Catalog v1

Numeric Road definition codes are stable and monotonic:

| Code | Canonical ID | UI name | Width | Direction |
| --- | --- | --- | ---: | --- |
| `1` | `basic-road` | Local Street | `0.72` | two-way |
| `2` | `collector-road` | Collector Road | `0.82` | two-way |
| `3` | `arterial-road` | Arterial Road | `0.92` | two-way |

`basic-road` remains the canonical internal ID for compatibility with existing saves/tests. Codes must never be reused for different meanings.

### Road semantics

Local Street:

- one lane per direction;
- target traffic speed 30 km/h;
- low relative capacity;
- curb parking allowed;
- direct building frontage preferred.

Collector Road:

- one lane per direction;
- target traffic speed 50 km/h;
- medium relative capacity;
- curb parking restricted;
- building frontage supported.

Arterial Road:

- one lane per direction;
- target traffic speed 70 km/h;
- high relative capacity;
- curb parking prohibited;
- building access remains supported through frontage/access anchors.

Traffic speed/capacity stay owned by `traffic-core`, not `road-core`.

## Road mutation / upgrade semantics

```text
empty + road type        → create
same road type           → no-change
different road type      → replace / upgrade
bulldoze                  → empty
```

Changing road type is one Road transaction, increments Road revision, rebuilds affected Road presentation and Traffic-derived state, and must not destroy Zones or Buildings merely because the road definition changed.

## Lane semantics v1

All v1 Road types expose one travel lane per direction. A real four-lane avenue is intentionally deferred to a future multi-cell road-footprint design; v1 must not compress four physical lanes into one current Road cell.

Introduce a world-level static Traffic handedness contract:

```ts
export type TrafficHandedness = 'left' | 'right';
```

Production default is `left`. Handedness must not be hard-coded inside individual renderers.

For left-hand traffic, the lane centerline for a directed road edge is offset to the left relative to travel direction. Reverse traffic uses the opposite physical side. Opposing directions must never share the same visual centerline.

## Intersection lane connectors

Canonical Traffic pathfinding remains edge-based in v1. Lane geometry is derived from the directed edge route:

```text
Traffic route
  → DirectedLanePath
  → lane centerline + deterministic intersection connector
```

Supported connector types are straight, left-turn, and right-turn. U-turns are not generated in v1. Turn geometry must remain inside the junction envelope and provide continuous heading rather than instantaneous orientation flips.

## Road presentation

`road-three` derives surface, edge treatment, center divider, intersection masking, and curb/parking edge treatment from Road definition plus connectivity. Lane markings must reflect actual lane semantics; visual markings may not fake lanes while Traffic still follows a shared centerline.

At intersections, lane/center markings stop before the junction interior.

## Vehicle Life authority

Introduce `packages/vehicle-life-core` as the authority for:

- private vehicle identity;
- household ownership;
- primary-driver assignment;
- canonical vehicle location;
- vehicle-to-trip reservation;
- vehicle persistence.

It does not own routing, Traffic congestion, Road state, Household membership/employment, or rendering.

## Household vehicle ownership v1

Use existing RCI households. For each resident Citizen who belongs to an active Household, has valid housing, and has active employment, Vehicle Life may maintain one primary Household-owned commuter vehicle assigned to that Citizen.

This deliberately avoids car-sharing scheduling in v1 while keeping the Household as owner and the same Citizen attached to the same deterministic vehicle identity.

## Vehicle identity and lifecycle

Canonical `VehicleId` remains stable across:

```text
Parked(Home)
→ morning Drive
→ Parked(Work)
→ evening Drive
→ Parked(Home)
→ Save / Load
```

Appearance derives deterministically from `vehicleId` so the same logical car has the same visible variant/color.

Recommended canonical location union:

```ts
export type VehicleLocation =
  | Readonly<{ kind: 'Parked'; buildingInstanceId: string }>
  | Readonly<{ kind: 'InTrip'; tripId: string; driverCitizenId: string }>
  | Readonly<{ kind: 'Stored' }>;
```

Do not persist mesh transforms, lane interpolation progress, visual parking XYZ, pool slot IDs, or Three.js object IDs.

## Mobility integration

Extend Mobility trips with `vehicleId: VehicleId | null`.

Rules:

- `Walk` requires `vehicleId === null`.
- `Drive` requires a concrete `vehicleId`.
- Drive is available only when the Citizen's assigned vehicle is parked at the trip origin building.

A Citizen who walks Home→Work leaves their car at Home. An evening Work→Home trip cannot magically use that car from Work.

## Parking v1

Canonical Vehicle Life stores only `Parked(buildingInstanceId)`. Presentation resolves a deterministic parking anchor from building frontage/access plus Road type.

Priority:

1. building/lot frontage anchor;
2. curb/frontage anchor when Road policy allows it;
3. safe lot-side fallback;
4. no visual materialization.

A missing safe anchor must never place a parked car in an active travel lane.

Multiple parked vehicles at one building use deterministic unique candidate slots sorted by `vehicleId`; if logical vehicles exceed visible slots, render a bounded deterministic subset.

## Presentation lifecycle

Moving Drive visuals key by `vehicleId`, not `tripId`.

Preferred visible lifecycle:

```text
parked
→ pull-out connector
→ lane route
→ pull-in connector
→ parked
```

When the vehicle remains within the materialization window, the same pooled visual should continue across state transitions rather than despawn/recreate.

Logical parked/moving vehicles may be large in count; Three.js objects remain bounded by spatial materialization and presentation caps.

## Persistence

- `RoadSaveV1` remains structurally valid because Road authority still stores one byte-sized definition code per cell. Codes `2` and `3` are monotonic extensions.
- `MobilitySaveV2` adds `vehicleId` to Mobility trips.
- `VehicleLifeSaveV1` persists Vehicle Life authority.
- `WorldSaveV8` composes RoadSaveV1, RciSaveV1, MobilitySaveV2, existing Traffic save, VehicleLifeSaveV1, and the existing world systems.

WorldSaveV7 must remain loadable. V7→V8 migration derives deterministic primary vehicles from RCI Household/Membership/Housing/Employment plus current Mobility state. Existing Traffic trip identity is preserved.

## Road-change reconciliation

Road upgrades during active trips rebuild Traffic-derived graph/profile state but preserve:

- Traffic trip ID;
- Citizen ID;
- Mobility trip ID;
- assigned `vehicleId`.

Road definition changes must never create replacement household vehicles.

## Failure semantics

A household-owned vehicle whose owner temporarily has no valid housing becomes `Stored`. Stored vehicles are not rendered and are unavailable to Drive but remain owned by the Household.

Irrecoverably failed Drive trips reconcile the vehicle back to the owner's valid Home building when possible, otherwise to `Stored`. No orphan `InTrip` vehicle may remain indefinitely.

## Non-goals v1

Not in scope:

- four/six-lane or multi-cell avenues;
- one-way roads;
- lane changing/overtaking;
- traffic signals, stop signs, roundabouts;
- parking search, parking fees, parking capacity gameplay;
- garages or vehicle purchasing;
- household car-sharing scheduling;
- freight/service traffic;
- leisure/random trips;
- accidents, fuel, maintenance;
- full pedestrian-to-car animation.

## Release acceptance

A representative street must visibly show two directional lanes and opposite traffic on opposite sides. Local/Collector/Arterial roads must be distinct and save/load correctly.

A representative employed Citizen must retain the same Household-owned vehicle through Home parking → morning commute → Work parking → evening commute → Home parking, including save/load.

Manual 414×896 acceptance must confirm lane readability, road-type distinction, parked-car plausibility, persistent vehicle identity, and smooth 4× presentation without new frame spikes.
