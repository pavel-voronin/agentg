import { inject, provide, type InjectionKey } from 'vue';

export type DashboardHostEvent = {
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

export type DashboardHost = {
  rpc<T = unknown>(method: string, params?: unknown): Promise<T>;
  selectModelRef(selection: ModelRefSelection): void;
  subscribeEvents(listener: (event: DashboardHostEvent) => void): () => void;
  subscribeModelRefs(listener: (selection: ModelRefSelection) => void): () => void;
};

const dashboardHostKey = Symbol.for('agentg:dashboard:host') as InjectionKey<DashboardHost>;

export function provideDashboardHost(host: DashboardHost): void {
  provide(dashboardHostKey, host);
}

export function useDashboardHost(): DashboardHost {
  const host = inject(dashboardHostKey);
  if (host === undefined) {
    throw new Error('Dashboard host is not available');
  }
  return host;
}
