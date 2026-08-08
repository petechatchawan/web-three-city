export type CityUiLayout = 'landscape-compact' | 'portrait' | 'desktop';

export interface CityUiViewport {
  readonly width: number;
  readonly height: number;
}

export function resolveCityUiLayout(viewport: CityUiViewport): CityUiLayout {
  if (viewport.width <= 0 || viewport.height <= 0) {
    throw new RangeError('city-ui:invalid-viewport');
  }
  if (viewport.width >= 1024) return 'desktop';
  return viewport.width > viewport.height ? 'landscape-compact' : 'portrait';
}
