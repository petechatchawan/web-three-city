# Task 20 — Performance and Allocation Guard

Added deterministic scale instrumentation and regression coverage for the 5,000-trip Traffic fixture and 20,000-Citizen fixture. Physical occupancy/reservation work uses indexed local structures; prepared route geometry is cached outside RAF; frame sampling reuses vectors and does not rebuild routes or scan the whole world.

TDD evidence: the scale guard and Traffic full suite passed under Node 22.23.2, with typecheck passing. The implementation preserves bounded materialization caps and does not add per-frame Three.js/DOM allocation or global O(n²) spacing.
