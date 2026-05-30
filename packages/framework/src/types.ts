export type MaybePromise<T> = T | Promise<T>;

export type ProcedureHandler = (...args: never[]) => unknown;

export type ProcedureMap = Record<string, ProcedureHandler>;
