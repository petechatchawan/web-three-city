from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text()
    if content.count(old) != 1:
        raise SystemExit(f"expected exactly one match in {path}, found {content.count(old)}")
    file_path.write_text(content.replace(old, new, 1))


replace_once(
    "browser-tests/game.spec.ts",
    "await expect(page.getByTestId('active-tool')).toHaveText('Residential');",
    "await expect(page.getByTestId('active-tool')).toHaveText('Residential Zone');",
)

replace_once(
    "browser-tests/zoning.spec.ts",
    "const points = await locate(page, [FIXTURE.road, FIXTURE.depth[0], FIXTURE.depth[3]]);",
    "const points = await locate(page, [FIXTURE.road, FIXTURE.depth[2], FIXTURE.depth[3]]);",
)
replace_once(
    "browser-tests/zoning.spec.ts",
    "await paint(page, points, 'Residential', FIXTURE.depth[0]);",
    "await paint(page, points, 'Residential', FIXTURE.depth[2]);",
)
replace_once(
    "browser-tests/zoning.spec.ts",
    "const zonePoint = at(points, FIXTURE.depth[0]);",
    "const zonePoint = at(points, FIXTURE.depth[2]);",
)

replace_once(
    "apps/game/src/terraform-occupancy-guard.ts",
    """export function guardTerraformPlanWithOccupancy(
  plan: TerraformPlan,
  roads: RoadSnapshot,
  zones: ZoneSnapshot,
): GuardedTerraformCandidate {
  if (!plan.valid) {
    return Object.freeze({
      corePlan: plan,
      previewPlan: plan,
      valid: false,
      invalidReason: plan.invalidReason,
      blockedRoadCells: EMPTY_CELLS,
      blockedZoneCells: EMPTY_CELLS,
    });
  }

  const blockedRoadCells = blockedCellsFor(plan, roads.width, roads.height, (cell) =>
    roadOccupiedAt(roads, cell),
  );
  const blockedZoneCells = blockedCellsFor(plan, zones.width, zones.height, (cell) =>
    zoneOccupiedAt(zones, cell),
  );
  const invalidReason: GameTerraformInvalidReason | null =
    blockedRoadCells.length > 0
      ? 'terraform:road-occupied'
      : blockedZoneCells.length > 0
        ? 'terraform:zone-occupied'
        : null;

  if (invalidReason === null) {
    return Object.freeze({
      corePlan: plan,
      previewPlan: plan,
      valid: true,
      invalidReason: null,
      blockedRoadCells: EMPTY_CELLS,
      blockedZoneCells: EMPTY_CELLS,
    });
  }

  const previewPlan: TerraformPlan = Object.freeze({ ...plan, valid: false });
  return Object.freeze({
    corePlan: plan,
    previewPlan,
    valid: false,
    invalidReason,
    blockedRoadCells,
    blockedZoneCells,
  });
}
""",
    """export function guardTerraformPlanWithOccupancy(
  plan: TerraformPlan,
  roads: RoadSnapshot,
  zones: ZoneSnapshot,
): GuardedTerraformCandidate {
  const blockedRoadCells = blockedCellsFor(plan, roads.width, roads.height, (cell) =>
    roadOccupiedAt(roads, cell),
  );
  const blockedZoneCells = blockedCellsFor(plan, zones.width, zones.height, (cell) =>
    zoneOccupiedAt(zones, cell),
  );
  const occupancyReason: GameTerraformInvalidReason | null =
    blockedRoadCells.length > 0
      ? 'terraform:road-occupied'
      : blockedZoneCells.length > 0
        ? 'terraform:zone-occupied'
        : null;

  if (occupancyReason !== null) {
    const previewPlan = plan.valid ? Object.freeze({ ...plan, valid: false }) : plan;
    return Object.freeze({
      corePlan: plan,
      previewPlan,
      valid: false,
      invalidReason: occupancyReason,
      blockedRoadCells,
      blockedZoneCells,
    });
  }

  if (!plan.valid) {
    return Object.freeze({
      corePlan: plan,
      previewPlan: plan,
      valid: false,
      invalidReason: plan.invalidReason,
      blockedRoadCells: EMPTY_CELLS,
      blockedZoneCells: EMPTY_CELLS,
    });
  }

  return Object.freeze({
    corePlan: plan,
    previewPlan: plan,
    valid: true,
    invalidReason: null,
    blockedRoadCells: EMPTY_CELLS,
    blockedZoneCells: EMPTY_CELLS,
  });
}
""",
)

replace_once(
    "apps/game/src/terraform-occupancy-guard.test.ts",
    """  it('preserves valid and Terrain-owned invalid plans unchanged', () => {
    const validPlan = planTerraformStroke(
      terrain(),
      { operation: 'raise', brushSize: 1, cells: [{ x: 8, z: 8 }] },
      WORLD_CONFIG,
    );
    const valid = guardTerraformPlanWithOccupancy(
      validPlan,
      createEmptyRoadSnapshot(WORLD_CONFIG),
      createEmptyZoneSnapshot(WORLD_CONFIG),
    );
    expect(valid).toMatchObject({
      valid: true,
      invalidReason: null,
      blockedRoadCells: [],
      blockedZoneCells: [],
    });
    expect(valid.previewPlan).toBe(validPlan);

    const invalidPlan = planTerraformStroke(
      terrain(),
      { operation: 'flatten', brushSize: 1, cells: [{ x: 8, z: 8 }], flattenTargetLevel: 2 },
      WORLD_CONFIG,
    );
    const invalid = guardTerraformPlanWithOccupancy(
      invalidPlan,
      roadsAt({ x: 8, z: 8 }),
      zonesAt({ x: 8, z: 8 }),
    );
    expect(invalid.invalidReason).toBe(invalidPlan.invalidReason);
    expect(invalid.blockedRoadCells).toEqual([]);
    expect(invalid.blockedZoneCells).toEqual([]);
    expect(invalid.previewPlan).toBe(invalidPlan);
  });
""",
    """  it('preserves valid and unblocked Terrain-owned invalid plans unchanged', () => {
    const validPlan = planTerraformStroke(
      terrain(),
      { operation: 'raise', brushSize: 1, cells: [{ x: 8, z: 8 }] },
      WORLD_CONFIG,
    );
    const valid = guardTerraformPlanWithOccupancy(
      validPlan,
      createEmptyRoadSnapshot(WORLD_CONFIG),
      createEmptyZoneSnapshot(WORLD_CONFIG),
    );
    expect(valid).toMatchObject({
      valid: true,
      invalidReason: null,
      blockedRoadCells: [],
      blockedZoneCells: [],
    });
    expect(valid.previewPlan).toBe(validPlan);

    const invalidPlan = planTerraformStroke(
      terrain(),
      { operation: 'flatten', brushSize: 1, cells: [{ x: 8, z: 8 }], flattenTargetLevel: 2 },
      WORLD_CONFIG,
    );
    const invalid = guardTerraformPlanWithOccupancy(
      invalidPlan,
      createEmptyRoadSnapshot(WORLD_CONFIG),
      createEmptyZoneSnapshot(WORLD_CONFIG),
    );
    expect(invalid.invalidReason).toBe(invalidPlan.invalidReason);
    expect(invalid.blockedRoadCells).toEqual([]);
    expect(invalid.blockedZoneCells).toEqual([]);
    expect(invalid.previewPlan).toBe(invalidPlan);
  });

  it('reports Zone occupancy before a generic Terrain-owned invalid reason', () => {
    const invalidPlan = planTerraformStroke(
      terrain(),
      { operation: 'flatten', brushSize: 1, cells: [{ x: 8, z: 8 }], flattenTargetLevel: 2 },
      WORLD_CONFIG,
    );
    expect(invalidPlan.valid).toBe(false);
    expect(invalidPlan.affectedVertices.length).toBeGreaterThan(0);

    const guarded = guardTerraformPlanWithOccupancy(
      invalidPlan,
      createEmptyRoadSnapshot(WORLD_CONFIG),
      zonesAt({ x: 8, z: 8 }),
    );

    expect(guarded.valid).toBe(false);
    expect(guarded.invalidReason).toBe('terraform:zone-occupied');
    expect(guarded.blockedRoadCells).toEqual([]);
    expect(guarded.blockedZoneCells).toEqual([{ x: 8, z: 8 }]);
    expect(guarded.corePlan).toBe(invalidPlan);
    expect(guarded.previewPlan.valid).toBe(false);
  });
""",
)
