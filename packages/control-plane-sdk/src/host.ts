import { inject, provide, type InjectionKey } from 'vue';

export type ControlPlaneHostEvent = {
  data?: unknown;
  id?: string;
  meta?: unknown;
  occurredAt?: Date | string;
  source?: string;
  type?: string;
};

export type ControlPlaneHost = {
  rpc<T = unknown>(method: string, params?: unknown): Promise<T>;
  subscribeEvents(listener: (event: ControlPlaneHostEvent) => void): () => void;
};

const controlPlaneHostKey: InjectionKey<ControlPlaneHost> = Symbol('controlPlaneHost');

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
