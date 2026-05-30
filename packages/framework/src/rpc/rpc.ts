import type { ProcedureMap } from '../types.js';

export type ProcedureServerOptions = {
  host?: string | undefined;
  port: number;
};

export type ProcedureServer = {
  readonly url: string;
  stop(): Promise<void>;
};

export type RpcFactory = {
  start(procedures: ProcedureMap): Promise<ProcedureServer>;
};
