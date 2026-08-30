# Game Application

- **Status:** FROZEN — OWNER APPROVED 2026-08-30
- **Owner:** `apps/game`
- **Role:** Product composition root, browser adapters, UI, input/camera presentation, and Three.js scene lifecycle

## Purpose

`apps/game` turns system/orchestration capabilities into the browser product. It owns environment-specific behavior, not World/Terrain gameplay authority.

## Main responsibilities

```text
bootstrap and error boundary
composition adapters
Home / New City / Load City / Game screens
shadcn-like design tokens and DOM primitives
Three.js Scene/Renderer lifecycle
production city camera with demand-driven keyboard/wheel motion
PC WASD + Q/E + Shift keyboard routing
PC/mobile Pointer Event gesture routing
pointer -> Raycaster adapter
IndexedDB CitySaveRepository adapter
crypto/clock/id browser adapters
```

## Dependency direction

```text
apps/game
  -> orchestration/city-session
  -> system public/composition surfaces for concrete wiring
  -> Three.js/browser APIs
```

App composition may call World/Terrain `./composition`; orchestration may not. App adapters must remain trivial wiring and must not duplicate city lifecycle policy.

## Authority rules

App-owned camera/input/UI/IndexedDB objects are not gameplay authority. Canonical city semantics remain in World/Terrain snapshots and live system state.

## Interaction lifecycle

```text
Pointer/Keyboard/Wheel Events
-> direct gesture intent OR driven camera motion OR semantic tap
-> driven motion uses demand RAF + frame-rate-independent damping
-> tap only -> pointer/NDC/Raycaster
-> Terrain semantic pick
```

Camera gesture and semantic pick are mutually exclusive for one gesture sequence.

## Persistence lifecycle

```text
city-session asks CitySaveRepository
-> app IndexedDB adapter
-> one complete structured-clone-compatible CitySave transaction
```

The application never depends on unload/pagehide to persist a city.

## UI direction

Neutral, compact, accessible, mobile-first visual language inspired by shadcn. No React/shadcn dependency is introduced. Shared colors/radius/spacing/focus/shadow values live in design tokens; repeated controls use small DOM primitives.

## Binding specs

- `specs/CAMERA-AND-INPUT-DESIGN.md`
- `specs/CITY-UI-AND-PERSISTENCE-ADAPTER-DESIGN.md`

## Verification evidence

- `verification/TERRAIN-PRODUCT-INTEGRATION-V1.md`

## Explicit non-goals

```text
canonical World/Terrain rules
generator algorithm ownership
Terraform policy
Roads/Zoning/Buildings
cloud sync
service worker/background sync
```
