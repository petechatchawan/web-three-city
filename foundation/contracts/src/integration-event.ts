export interface IntegrationEvent<
  TType extends string = string,
  TPayload = unknown,
> {
  readonly type: TType;
  readonly payload: TPayload;
}
