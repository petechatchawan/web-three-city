# Road Reversible Stroke and Preview Isolation — Owner Review Checklist

- [ ] Preview colors only the active Build/Bulldoze footprint.
- [ ] Committed Roads outside the footprint remain committed-colored.
- [ ] Exact reverse movement pops the active tail.
- [ ] Branching after reverse discards the abandoned tail.
- [ ] Fast reverse processes rasterized cells sequentially.
- [ ] Self-crossing does not erase unrelated non-tail history.
- [ ] Requested/Effective counts decrease after backtracking.
- [ ] Pointer-up commits only the remaining effective footprint.
- [ ] Build and Bulldoze share the same reversible semantics.
- [ ] TDD, Lean CI, Full CI, pixel evidence, and no-temporary-workflow gates are sufficient.
