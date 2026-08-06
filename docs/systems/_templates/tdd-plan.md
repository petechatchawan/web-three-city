# <Feature> Implementation Plan

> **For agentic workers:** Execute task-by-task with test-first changes and fresh verification evidence.

**Goal:** One sentence describing the delivered capability.

**Architecture:** Two or three sentences describing ownership and integration.

**Tech Stack:** Relevant packages, libraries, runtime, and test tools.

## Global Constraints

- Copy exact invariants and scope boundaries from the approved specification.
- Do not create a second authority for persisted or derived state.
- Every behavior change includes tests and living system-document updates.

---

### Task 1: <Independently reviewable component>

**Files:**
- Create: `exact/path`
- Modify: `exact/path`
- Test: `exact/path`

**Interfaces:**
- Consumes: exact contracts from preceding tasks.
- Produces: exact contracts later tasks may rely on.

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run the focused test and confirm the expected failure**
- [ ] **Step 3: Implement the minimum production change**
- [ ] **Step 4: Run focused and affected tests**
- [ ] **Step 5: Update the living system overview when behavior changed**
- [ ] **Step 6: Commit the independently testable result**

## Final Verification

- [ ] Format, lint, typecheck, unit tests, build, and browser tests pass as applicable.
- [ ] Save/load and continuous-run equivalence are verified when state changed.
- [ ] System overview, ADR links, persistence notes, and limitations match the delivered behavior.
- [ ] No placeholder or untracked follow-up is hidden in the completed plan.
