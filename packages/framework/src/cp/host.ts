import { inject, provide, type InjectionKey } from 'vue';

export type ControlPlaneHostEvent = {
  data?: unknown;
  id?: string;
  meta?: unknown;
  occurredAt?: string;
  type?: string;
};

export type ModelRefSelection = {
  id: string;
  model: string;
};

export type ControlPlaneHost = {
  rpc<T = unknown>(method: string, params?: unknown): Promise<T>;
  selectModelRef(selection: ModelRefSelection): void;
  subscribeEvents(listener: (event: ControlPlaneHostEvent) => void): () => void;
  subscribeModelRefs(listener: (selection: ModelRefSelection) => void): () => void;
};

const controlPlaneHostKey = Symbol.for(
  'agentg:control-plane:host'
) as InjectionKey<ControlPlaneHost>;

export function provideControlPlaneHost(host: ControlPlaneHost): void {
  provide(controlPlaneHostKey, host);
}

export function useControlPlaneHost(): ControlPlaneHost {
  const host = inject(controlPlaneHostKey);
  if (host === undefined) {
    throw new Error('Control Plane host is not available');
  }
  return host;
}
