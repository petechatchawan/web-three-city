export interface CommandRejection {
  readonly code: string;
  readonly message: string;
}

export type CommandResult<
  TSuccess,
  TRejection extends CommandRejection = CommandRejection
> =
  | {
      readonly status: 'success';
      readonly value: TSuccess;
    }
  | {
      readonly status: 'rejected';
      readonly rejection: TRejection;
    };
