export interface IntegrationEvent<TType extends string, TPayload> {
  readonly type: TType;
  readonly payload: Readonly<TPayload>;
  readonly occurredAt?: string;
  readonly sequence?: number;
}
