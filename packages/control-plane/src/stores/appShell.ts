import { acceptHMRUpdate, defineStore } from 'pinia';

import {
  CONTROL_PLANE_STORAGE_KEYS,
  readStoredBoolean,
  writeStorage
} from './controlPlaneStorage.js';
import type { StatusBadgeKind } from './controlPlaneTypes.js';

type AppShellState = {
  dashboardCollapsed: boolean;
  eventsPanelCollapsed: boolean;
  gatewayStatus: StatusBadgeKind;
  tdlibStatus: StatusBadgeKind;
};

export const useAppShellStore = defineStore('controlPlane.appShell', {
  actions: {
    setDashboardCollapsed(collapsed: boolean) {
      this.dashboardCollapsed = collapsed;
      writeStorage(CONTROL_PLANE_STORAGE_KEYS.dashboardCollapsed, collapsed ? '1' : '0');
    },
    setEventsPanelCollapsed(collapsed: boolean) {
      this.eventsPanelCollapsed = collapsed;
      writeStorage(CONTROL_PLANE_STORAGE_KEYS.eventsPanelCollapsed, collapsed ? '1' : '0');
    },
    setGatewayStatus(status: StatusBadgeKind) {
      this.gatewayStatus = status;
    },
    setTdlibStatus(status: StatusBadgeKind) {
      this.tdlibStatus = status;
    }
  },
  state: (): AppShellState => ({
    dashboardCollapsed: readStoredBoolean(CONTROL_PLANE_STORAGE_KEYS.dashboardCollapsed, false),
    eventsPanelCollapsed: readStoredBoolean(CONTROL_PLANE_STORAGE_KEYS.eventsPanelCollapsed, false),
    gatewayStatus: 'warn',
    tdlibStatus: 'warn'
  })
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppShellStore, import.meta.hot));
}
