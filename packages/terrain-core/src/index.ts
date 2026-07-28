export { buildCanonicalNormals } from './canonical-normals.js';
export type { CanonicalNormalField } from './canonical-normals.js';
export { buildTerrainChunkMesh } from './chunk-mesher.js';
export { allChunkCoords, chunkCellBounds, chunkForCell } from './chunking.js';
export type { ChunkCellBounds, ChunkCoord } from './chunking.js';
export { resolveDirtyChunks } from './dirty-region.js';
export type { TerrainDirtyRegion } from './dirty-region.js';
export { HeightLattice, TerrainInvariantError } from './height-lattice.js';
export type { TerrainInvariantErrorCode } from './height-lattice.js';
export type { MeshBounds, OuterSkirtMeshData, TerrainChunkMeshData } from './mesh-data.js';
export { buildOuterSkirtMesh } from './outer-skirt-mesher.js';
export { classifyTerrainShape, normalizeTerrainCorners } from './shape-classifier.js';
export type { TerrainShape } from './shape-classifier.js';
export { decodeTerrainSaveV1, encodeTerrainSaveV1 } from './serialization.js';
export type { TerrainSaveError, TerrainSaveErrorCode, TerrainSaveV1 } from './serialization.js';
export { createTerrainMap } from './terrain-map.js';
export type { CreateTerrainMapInput, TerrainMap, TerrainSnapshot } from './terrain-map.js';
export { expandTerraformBrushCells } from './terraform-brush.js';
export { rasterizeTerraformCellLine } from './terraform-cell-line.js';
export { TerraformContractError } from './terraform-contracts.js';
export type {
  TerraformBrushSize,
  TerraformCommitReceipt,
  TerraformCommitResult,
  TerraformContractErrorCode,
  TerraformInvalidReason,
  TerraformOperation,
  TerraformPlan,
  TerraformStrokeInput,
  WorldToolMode,
} from './terraform-contracts.js';
export { commitTerraformPlan, planTerraformStroke } from './terraform-plan.js';
export { TerraformUndoStore } from './terraform-undo-store.js';
export { CELL_TRIANGLES, selectTerrainDiagonal } from './topology.js';
export type { TerrainCorner, TerrainCorners, TerrainDiagonal } from './topology.js';
export { validateTerrainInput } from './validation.js';
export type { TerrainValidationIssue, TerrainValidationIssueCode } from './validation.js';
