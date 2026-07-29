export { createChunkGeometry } from './chunk-geometry-adapter.js';
export { createCoreTerrainPresentationSource } from './core-terrain-source.js';
export { createTerrainMaterials } from './material-factory.js';
export type { TerrainMaterials } from './material-factory.js';
export { createOuterSkirtGeometry } from './outer-skirt-presentation.js';
export { TerrainPresentation } from './terrain-presentation.js';
export type {
  TerrainPresentationBuild,
  TerrainPresentationSource,
} from './terrain-presentation.js';
export { detectWebGL2 } from './webgl-capability.js';
export type { WebGL2Capability } from './webgl-capability.js';
export {
  SelectedCellPresentation,
  SelectionPresentationError,
  buildSelectedCellOverlayData,
} from './selected-cell-presentation.js';
export type {
  SelectedCellOverlayData,
  SelectionPresentationErrorCode,
} from './selected-cell-presentation.js';
export { TerrainGridPresentation, buildTerrainGridChunkData } from './terrain-grid-presentation.js';
export type { TerrainGridChunkData } from './terrain-grid-presentation.js';
export { buildTerraformPreviewMesh } from './terraform-preview-geometry.js';
export type { TerraformPreviewMeshData } from './terraform-preview-geometry.js';
export { TerraformPreviewPresentation } from './terraform-preview-presentation.js';
