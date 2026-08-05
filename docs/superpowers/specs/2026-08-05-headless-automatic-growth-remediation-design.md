# Headless Automatic Growth Remediation Design

## Status

Approved for implementation on PR #23.

## Problem

Automatic Growth must never participate in the interactive world-tool lifecycle. The current production graph still contains the hidden `building-develop` tool, its DOM control, tool-mode discriminator, input route, bootstrap listener, status copy, and transaction path. Hiding the button does not remove that route and permits automatic or stale callers to trigger interactive behavior, including `Zones developed`, transaction presentation, stroke cancellation, and a transition to Navigate.

## Decision

Automatic Growth is a headless background domain operation. Interactive Develop Zones does not exist in the production tool-routing graph.

## Architecture

- `executeWorldGrowthTick` remains the only automatic-development entry point.
- `GameRuntime.runBackgroundGrowthTick` applies the returned simulation/building snapshots and refreshes derived presentation/occupancy only.
- Background Growth must not invoke UI controls, pointer input, interactive Building transactions, status mutation, player Undo ownership, tool cancellation, or tool selection.
- The production `GameToolMode` union contains one Building mode only: `building-bulldoze`.
- The production DOM contains no Develop Zones button, including hidden or aria-hidden controls.
- `GameInput` routes Building input only to Bulldoze Building.
- Interactive Building commit code accepts only a bulldoze request and cannot call `planBuildingDevelopment`.

## Data Flow

1. The simulation runtime advances one logical tick.
2. `main.ts` calls `GameRuntime.runBackgroundGrowthTick(simulation)` when automatic Growth is enabled.
3. The runtime calls `executeWorldGrowthTick` with the current simulation snapshot, Building snapshot, Building environment, and world configuration.
4. When Growth changes Buildings, the runtime replaces the Building snapshot, reloads Building presentation, rebuilds zone occupancy, increments background growth evidence, and updates the Building count.
5. Active tool mode, active pointer/stroke state, player status, and player Undo entry remain untouched.

## Production Tool Graph

Allowed Building tool:

- `building-bulldoze`

Forbidden production symbols and controls:

- `building-develop`
- `[data-action="tool-building-develop"]`
- `Develop Zones`
- `planBuildingDevelopment` in the interactive application shell

## Acceptance Criteria

- No Develop Zones control exists in the production DOM.
- `building-develop` is not a valid `GameToolMode` and cannot be selected through keyboard, UI, input, or bootstrap routing.
- Automatic Growth can create a Building while Residential, Commercial, Industrial, Remove Zone, Road, Terraform, or Bulldoze Building remains selected.
- An in-progress Zoning stroke remains active across a Growth evaluation and can complete normally.
- Automatic Growth emits no Navigate click, tool cancel, Building transaction presentation event, `Zones developed` status, or player Undo replacement.
- Interactive Bulldoze Building behavior and Undo remain unchanged.
- Unit, typecheck, build, and full Playwright verification pass on one exact head.

## Test Strategy

- RED unit test: rendered Game UI must contain no Develop Zones action or copy.
- RED browser regression: production DOM must not contain the Develop Zones control; Growth during an active Industrial stroke must preserve the tool and stroke without interactive events.
- Compile-time regression: `GameToolMode`, tool action records, UI button records, and input validation derive from the production mode set with no `building-develop` member.
- Full verification: `pnpm verify:full` and exact-head GitHub Actions evidence.
