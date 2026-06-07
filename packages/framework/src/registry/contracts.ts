export type ModuleManifest = {
  module: string;
  procedures?: readonly string[] | undefined;
  required?: boolean | undefined;
  rpcUrl: string;
};

export type ModuleRecord = {
  module: string;
  procedures: readonly string[];
  registeredAt: string;
  required: boolean;
  rpcUrl: string;
};

export type Snapshot = {
  modules: readonly ModuleRecord[];
  version: number;
};
