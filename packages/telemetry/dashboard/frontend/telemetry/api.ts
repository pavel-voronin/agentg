import { useDashboardHost } from '@agentg/framework/dashboard';

import { LINKS_METHOD, type LinkSet } from './contracts.js';

export function useTelemetryDashboardApi() {
  const host = useDashboardHost();

  return {
    links(): Promise<LinkSet> {
      return host.rpc<LinkSet>(LINKS_METHOD);
    }
  };
}
