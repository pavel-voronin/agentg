import { acceptHMRUpdate, defineStore } from 'pinia';

import {
  CONTROL_PLANE_STORAGE_KEYS,
  readStoredBoolean,
  writeStorage
} from './controlPlaneStorage.js';
import type { StatusBadgeKind } from './controlPlaneTypes.js';
import { DEFAULT_PAGE_SEGMENT, routeFromPathname, type ShellRoute } from './shellRoute.js';

type AppShellState = {
  controlPlaneStatus: StatusBadgeKind;
  route: ShellRoute;
  slotDebugEnabled: boolean;
};

type BrowserGlobal = {
  location?: {
    pathname?: string;
  };
};

export const useAppShellStore = defineStore('controlPlane.appShell', {
  actions: {
    setSlotDebugEnabled(enabled: boolean) {
      this.slotDebugEnabled = enabled;
      writeStorage(CONTROL_PLANE_STORAGE_KEYS.slotDebugEnabled, enabled ? '1' : '0');
    },
    setControlPlaneStatus(status: StatusBadgeKind) {
      this.controlPlaneStatus = status;
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
      controlPlaneStatus: 'warn',
      route,
      slotDebugEnabled: readStoredBoolean(CONTROL_PLANE_STORAGE_KEYS.slotDebugEnabled, false)
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
