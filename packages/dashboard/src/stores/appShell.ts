import { acceptHMRUpdate, defineStore } from 'pinia';

import { DASHBOARD_STORAGE_KEYS, readStoredBoolean, writeStorage } from './dashboardStorage.js';
import type { StatusBadgeKind } from './dashboardTypes.js';
import { DEFAULT_PAGE_SEGMENT, routeFromPathname, type ShellRoute } from './shellRoute.js';

type AppShellState = {
  dashboardStatus: StatusBadgeKind;
  route: ShellRoute;
  slotDebugEnabled: boolean;
};

type BrowserGlobal = {
  location?: {
    pathname?: string;
  };
};

export const useAppShellStore = defineStore('dashboard.appShell', {
  actions: {
    setSlotDebugEnabled(enabled: boolean) {
      this.slotDebugEnabled = enabled;
      writeStorage(DASHBOARD_STORAGE_KEYS.slotDebugEnabled, enabled ? '1' : '0');
    },
    setDashboardStatus(status: StatusBadgeKind) {
      this.dashboardStatus = status;
    },
    setRoute(route: ShellRoute) {
      this.route = route;
    },
    setPageRoute(pageSegment: string, segments: readonly string[] = []) {
      this.setRoute({
        pageSegment,
        segments: [...segments]
      });
    },
    setPageRouteSegments(segments: readonly string[]) {
      this.setPageRoute(this.route.pageSegment, segments);
    }
  },
  state: (): AppShellState => {
    const route = routeFromPathname(readBrowserPathname(), DEFAULT_PAGE_SEGMENT);
    return {
      dashboardStatus: 'warn',
      route,
      slotDebugEnabled: readStoredBoolean(DASHBOARD_STORAGE_KEYS.slotDebugEnabled, false)
    };
  }
});

function readBrowserPathname(): string {
  const location = (globalThis as BrowserGlobal).location;
  return typeof location?.pathname === 'string' ? location.pathname : '/';
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppShellStore, import.meta.hot));
}
