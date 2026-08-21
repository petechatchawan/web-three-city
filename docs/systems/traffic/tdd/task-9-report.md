# Task 9 — Authoritative Drive Lifecycle

Added the V2 Drive movement phases `WaitingForEntry`, `Entering`, `Travelling`, and `Leaving`, separate from terminal status. A transport quantum crosses at most one lifecycle boundary; final road completion enters `Leaving`, and only a later authoritative quantum settles arrival. V2 validation rejects invalid phase/status combinations and defaults active Drive trips to `WaitingForEntry`.

TDD evidence: lifecycle assertions were RED against the previous immediate progression/terminal behavior, then GREEN with the focused traffic-core suite and typecheck passing under Node 22.23.2.
