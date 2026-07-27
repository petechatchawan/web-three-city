import type { CameraState } from '@web-three-city/camera-input';
import type { CellCoord } from '@web-three-city/world-core';

export interface InteractionEvidence {
  readonly camera: CameraState;
  readonly selectedCell: CellCoord | null;
  readonly gridVisible: boolean;
  readonly activePointerCount: number;
  readonly allWorldCornersInsideUsableViewport: boolean;
  readonly framingMarginRatio: number;
  readonly sceneRootCounts: {
    readonly terrain: number;
    readonly grid: number;
    readonly selection: number;
  };
}

declare global {
  interface Window {
    __WEB_THREE_CITY_INTERACTION__?: InteractionEvidence;
  }
}
