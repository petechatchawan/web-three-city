export interface DisposableElement<T extends HTMLElement> {
  readonly element: T;
  dispose(): void;
}
