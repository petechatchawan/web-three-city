export interface UiHandle<T extends HTMLElement = HTMLElement> {
  readonly element: T;
  dispose(): void;
}

export interface StatefulUiHandle<TState, T extends HTMLElement = HTMLElement>
  extends UiHandle<T> {
  render(state: TState): void;
}

export type DisposableElement<T extends HTMLElement> = UiHandle<T>;
