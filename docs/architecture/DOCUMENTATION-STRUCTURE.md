# Documentation Structure

- **Status:** FROZEN
- **Date:** 2026-08-28
- **Scope:** Documentation ownership, authority hierarchy, system documentation layout, lifecycle, and handoff rules
- **Depends on:** Product Architecture, ADR-000, A3 Repository Topology & Ownership Model, A4 Package Boundary Model
- **Sequence:** A10 — Documentation Structure

## 1. Purpose

Documentation is part of the architecture authority model, not an afterthought.

Core rule:

```text
Repository-wide decisions live with repository-wide architecture.
System-owned decisions live with the owning system.
Chat history is never the canonical source of truth.
```

Documentation structure follows ownership just like code and tests.

## 2. Canonical documentation topology

```text
docs/
├─ architecture/
│  ├─ PRODUCT-ARCHITECTURE.md
│  ├─ PRODUCT-ARCHITECTURE-BLUEPRINT.md
│  ├─ REPOSITORY-TOPOLOGY-AND-OWNERSHIP.md
│  ├─ PACKAGE-BOUNDARY-MODEL.md
│  ├─ SYSTEM-INTERNAL-STRUCTURE.md
│  ├─ PUBLIC-EXPORT-AND-DEPENDENCY-RULES.md
│  ├─ COMPOSITION-AND-ORCHESTRATION-STRUCTURE.md
│  ├─ FOUNDATION-STRUCTURE.md
│  ├─ TESTING-STRUCTURE.md
│  ├─ DOCUMENTATION-STRUCTURE.md
│  ├─ ARCHITECTURE-ENFORCEMENT-DESIGN.md
│  ├─ FOUNDATION-BOOTSTRAP-STRUCTURE.md
│  └─ adr/
│
├─ systems/
│  └─ <system>/
│     ├─ README.md
│     ├─ specs/
│     ├─ adr/
│     ├─ tdd/
│     └─ verification/
│
├─ orchestration/
│  └─ <concern>/
│     ├─ README.md
│     ├─ specs/
│     └─ verification/
│
└─ apps/
   └─ <app>/
      ├─ README.md
      ├─ specs/
      └─ verification/
```

`FOUNDATION-BOOTSTRAP-STRUCTURE.md` is the single active A12 structural authority for the initial scaffold. The earlier clean-slate Bootstrap baseline was removed after reconciliation because Git history is sufficient and duplicate active authority is forbidden.

Directories/files are created only when content exists; empty speculative documentation trees are not required.

## 3. Repository-wide architecture authority

`docs/architecture/` owns decisions that apply across packages/systems.

Examples:

```text
repository topology
package boundary model
cross-system communication rules
public export rules
Foundation structure
testing structure
architecture enforcement
runtime/persistence/ECS repository-wide ADRs
```

A system document must not silently override a repository-wide architecture contract.

If a system genuinely requires an exception, that exception must be approved at the appropriate architecture level and explicitly documented.

## 4. Architecture Decision Records

Repository ADRs live under:

```text
docs/architecture/adr/
```

Use an ADR when a repository-wide decision:

```text
has meaningful alternatives/trade-offs
changes or constrains architecture behavior
needs durable rationale
may be revisited/superseded explicitly
```

ADR content should include at least:

```text
status
date/scope
context
decision
consequences
binding invariants/follow-ups where applicable
```

ADR numbers remain stable. Do not reuse an ADR number for a different decision.

## 5. Architecture contract documents vs ADRs

Not every architecture contract must be an ADR.

Use a contract/structure document when the primary purpose is to define a broad operational model such as:

```text
Repository Topology
Package Boundary Model
Testing Structure
Documentation Structure
```

Use ADRs primarily for decisions where alternatives/rationale are central.

Both are binding when marked `FROZEN` and must remain consistent with Product Architecture.

## 6. System documentation ownership

System-specific binding documentation lives under:

```text
docs/systems/<system>/
```

The documentation owner must match the code/package owner conceptually:

```text
systems/roads
<->
docs/systems/roads
```

A system's documentation should be understandable without inspecting unrelated system internals.

## 6.1 App and orchestration documentation ownership

App-specific browser/presentation/environment decisions live under `docs/apps/<app>/`. Orchestration concern decisions live under `docs/orchestration/<concern>/`. These trees use the same ownership rule as systems: README is an entry map, `specs/` contains binding behavior/architecture for that owner, and `verification/` stores durable evidence when useful.

App/orchestration documents must not override repository-wide architecture or system-owned semantic authority.

## 7. System `README.md`

`README.md` is the system entry map, not the place to duplicate all specs.

It should summarize:

```text
Purpose
Canonical Authority
Key Derived State
Public Commands/Queries/Events at a high level
External Dependencies
Presentation ownership
Persistence ownership status
Current binding specs/ADRs
Verification status/evidence links
```

It should link to authoritative documents rather than copy large sections that can drift.

## 8. `specs/`

`docs/systems/<system>/specs/` contains binding behavior/architecture specifications for that system.

A spec should answer as applicable:

```text
purpose/scope
canonical authority
derived state
commands
queries
integration events
persistence ownership
external dependencies
presentation projection
invariants
failure/rejection semantics
testing/acceptance boundaries
explicit non-goals
```

A spec may be split by coherent concern when one file becomes hard to review, but avoid document fragmentation by default.

## 9. System `adr/`

Use system-local ADRs for decisions whose impact is primarily inside that system ownership boundary and does not modify repository-wide architecture.

Examples:

```text
Terrain reconstruction strategy
Road graph internal model
Building placement authority
```

If a decision changes repository-wide rules, it belongs in `docs/architecture/adr/` instead.

## 10. `tdd/`

`docs/systems/<system>/tdd/` contains implementation plans derived from approved binding specifications.

TDD plans are execution artifacts, not architecture authority.

They may describe:

```text
RED cases
implementation sequence
GREEN milestones
refactoring checkpoints
verification commands
```

If a TDD plan discovers a required architecture/spec change, update/review the binding design first rather than silently changing semantics in the plan.

## 11. `verification/`

`docs/systems/<system>/verification/` stores concise verification evidence/status when durable evidence is useful.

Examples:

```text
accepted test commands and outcomes
manual/browser acceptance result where required
exact-head verification reference
known intentionally skipped checks with rationale
```

Verification documents do not redefine requirements. They prove a current spec/contract against a particular implementation state.

## 12. Document status model

Use a small, explicit status vocabulary:

```text
REVIEW DRAFT — NOT FROZEN
FROZEN
SUPERSEDED
```

Optional temporary status may be introduced only if a current workflow need justifies it; avoid status proliferation.

Meanings:

```text
REVIEW DRAFT — NOT FROZEN
  proposal under review; not binding

FROZEN
  approved current authority

SUPERSEDED
  historical current-line document replaced by a named newer authority; not active
```

Under ADR-000, pre-reset documents are not brought into the active tree as superseded/reference material by default.

## 13. Supersession rule

When a current clean-slate document is intentionally replaced:

```text
new document explicitly names what it supersedes
old document is marked SUPERSEDED or removed when history alone is sufficient
active indexes/README links point only to current authority
```

Do not maintain duplicate active specs for the same invariant.

Git history is sufficient for ordinary document history; filenames do not need `v2`, `old`, or date suffixes merely to preserve previous states.

## 14. Naming policy

Architecture filenames use stable descriptive uppercase names where appropriate:

```text
PACKAGE-BOUNDARY-MODEL.md
TESTING-STRUCTURE.md
```

ADRs use:

```text
ADR-NNN-short-kebab-title.md
```

System specs use concise concern names under the owning system directory.

Avoid architecture generations such as:

```text
architecture-v2.md
new-terrain.md
final-final.md
```

unless a version number is itself a real external/product protocol requirement.

## 15. No duplication as authority

A binding rule should have one primary authority location.

Other docs may summarize/link it, but should not fork wording in a way that creates competing truths.

Example:

```text
A6 owns exact package export permission rules.
System README may summarize the surfaces, but does not redefine permissions.
```

When duplication is unavoidable for readability, the summary must identify the primary authority.

## 16. Cross-document dependency declarations

Binding docs should state their relevant dependencies near the top.

This supports:

```text
review order
change impact analysis
architecture enforcement/document lint later
agent handoff
```

Dependencies are conceptual documentation dependencies, not runtime package imports.

## 17. Handoff-ready writing

A binding document must be understandable without relying on this conversation.

It should contain enough context to answer:

```text
What is being decided?
Why does this owner/document exist?
What is allowed?
What is forbidden?
What remains deferred?
What document governs adjacent questions?
```

Avoid references such as:

```text
"as we discussed earlier"
"same as the previous version"
"use the old implementation"
```

## 18. Explicit deferrals

Architecture/spec documents should list important decisions intentionally deferred elsewhere.

This prevents omission from being mistaken for permission.

A deferred item should point to the owning future document/ADR when known.

Do not use `TBD` as a substitute for deciding whether something is in or out of current scope.

## 19. No placeholder acceptance

A document proposed for `FROZEN` status must not contain unresolved placeholders such as:

```text
TODO
TBD
FIXME
???
placeholder language with multiple conflicting choices
```

If an unresolved decision is legitimately future work, move it to an explicit Deferred Decisions section with a clear owner/scope.

## 20. Review model

Architecture documents may be reviewed individually or as an explicitly declared batch.

For a batch review:

```text
all documents remain REVIEW DRAFT
cross-document self-review occurs before human review
a batch change list identifies contradictions/gaps found
human approval applies to the reviewed revision set
only then are documents marked FROZEN
```

This supports faster architecture work without weakening the approval gate.

## 21. Diagrams

Diagrams are explanatory unless explicitly designated as a binding model.

Textual invariants take precedence when a decorative diagram is ambiguous.

Prefer Mermaid or text diagrams that can live in Git and be reviewed as source.

Avoid making binary diagram artifacts the only source of architecture truth.

## 22. Examples and pseudo-code

Examples illustrate rules; they do not automatically create package/system approval.

Each document should distinguish conceptual examples from approved concrete topology when confusion is possible.

For example:

```text
systems/terrain
```

may illustrate ownership without authorizing Terrain implementation before its design gate.

## 23. Documentation change discipline

When implementation changes a binding contract intentionally:

```text
update binding document in the same coherent change
update affected tests/contracts
record ADR if decision/rationale warrants it
```

Do not allow architecture docs to lag known intentional architecture changes.

Conversely, documentation cleanup must not silently change semantics without review.

## 24. Documentation and code generation

Generated documentation may supplement manually authored contracts, but generated output is not automatically architecture authority.

Machine-derived inventories such as dependency graphs should identify their source data and generation command.

Manual graph copies must not become a competing authority to source-derived architecture graphs.

## 25. Anti-pattern checklist

- [ ] chat history is required to understand binding rule;
- [ ] repository-wide rule is hidden in one system doc;
- [ ] system doc overrides repository architecture silently;
- [ ] README duplicates entire specs and drifts;
- [ ] TDD plan changes architecture without spec review;
- [ ] verification evidence defines new behavior;
- [ ] multiple active specs own the same invariant;
- [ ] bootstrap structure and another executable bootstrap baseline coexist as competing active authorities;
- [ ] filenames use `v2/new/old/final-final` to manage history;
- [ ] unresolved TODO/TBD remains in document marked FROZEN;
- [ ] pre-reset docs are restored as active reference by default;
- [ ] binary diagram is sole source of a binding rule;
- [ ] manual dependency graph competes with machine-derived source graph;
- [ ] example package name is mistaken for package-creation approval.

## 26. Definition of Done examples

```text
repository-wide Query/Command/Event semantics
-> docs/architecture/adr/ADR-001...

package boundary rules
-> docs/architecture/PACKAGE-BOUNDARY-MODEL.md

Roads system overview/index
-> docs/systems/roads/README.md

Road construction semantics
-> docs/systems/roads/specs/<concern>.md

Road graph internal design trade-off
-> docs/systems/roads/adr/ADR-...md

Road implementation RED/GREEN plan
-> docs/systems/roads/tdd/<plan>.md

Road verification evidence
-> docs/systems/roads/verification/<evidence>.md

architecture batch under review
-> all affected docs REVIEW DRAFT until batch approval

A12 is the active Bootstrap structure and prior baseline has been removed
-> one active Bootstrap authority
```

## 27. Deferred decisions

A10 intentionally does not freeze:

```text
automatic docs site generator
API reference generator
changelog/release-note tooling
external public documentation strategy
long-term archival policy beyond Git history/current supersession
A11 document lint implementation
```

## 28. Final invariants

```text
Documentation follows ownership.
Repository architecture lives in docs/architecture.
System authority lives in docs/systems/<system>.
README indexes; specs/ADRs own detail.
TDD plans execute approved design; they do not redefine it.
Verification proves requirements; it does not create them.
Chat history is never canonical authority.
One binding invariant has one primary authority.
FROZEN documents contain no unresolved placeholders.
Explicit deferral is preferred to vague TBD.
Git history manages ordinary document history; no v2/old archive naming by default.
Batch review is allowed only while all batch documents remain non-frozen until approval.
A12 is the single active Bootstrap structural authority before implementation planning.
```