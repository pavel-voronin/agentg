import type { ProcedureMap } from '../types.js';

export type RpcMethod<TProcedure> = TProcedure extends () => infer TOutput
  ? () => Promise<Awaited<TOutput>>
  : TProcedure extends (input: infer TInput) => infer TOutput
    ? (input: TInput) => Promise<Awaited<TOutput>>
    : never;

export type RpcClient<TProcedures extends ProcedureMap> = {
  readonly [TName in keyof TProcedures]: RpcMethod<TProcedures[TName]>;
};

export type InternalRpcDomainOptions = {
  timeoutMs?: number | undefined;
  url: string;
};

export type InternalRpcDomain<TProcedures extends ProcedureMap> = (
  options: InternalRpcDomainOptions
) => RpcClient<TProcedures>;

export type ProcedureServerOptions = {
  host?: string | undefined;
  port: number;
  service: string;
};

export type ProcedureServer = {
  readonly url: string;
  stop(): Promise<void>;
};

export type RpcFactory = {
  start(procedures: ProcedureMap): Promise<ProcedureServer>;
};
