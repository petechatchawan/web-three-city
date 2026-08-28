export interface CommandRejection<TCode extends string = string> {
  readonly code: TCode;
  readonly message: string;
}

export type CommandResult<
  TValue,
  TRejection extends CommandRejection = CommandRejection,
> =
  | Readonly<{
      ok: true;
      value: TValue;
    }>
  | Readonly<{
      ok: false;
      rejection: TRejection;
    }>;
