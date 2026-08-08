export interface UiAdapter<TProjection> {
  readonly element: HTMLElement;
  update(projection: TProjection): void;
  dispose(): void;
}
