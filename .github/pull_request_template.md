## Scope

- System:
- Owning package(s):
- Behavior/contract changed:

## Verification

Apply `AGENTS.md` § Verification Escalation Rules directly; do not independently redefine when a level is required.

- [ ] Targeted package tests passed.
- [ ] Targeted package typecheck passed.
- [ ] Affected consumer verification required by `AGENTS.md` § Verification Escalation Rules passed.
- [ ] Relevant browser verification passed when the escalation rules require it.
- [ ] Final repository/CI evidence is recorded for the required level.

Commands/results:

```text

```

## Documentation

- [ ] `docs/systems/<system>/README.md` is updated in this PR; or
- [ ] Behavior/contracts/ownership/Save/dependency boundaries are unchanged, so a documentation update is not required.

## Definition of Done

- [ ] No unrelated changes.
- [ ] No temporary/debug artifacts.
- [ ] Determinism and Save compatibility are addressed when applicable.
- [ ] Exact candidate SHA is recorded when final exact-head verification is required.
