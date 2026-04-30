import type {
  AppShellView,
  StatusBadgeKind,
  StatusBadgeView
} from '../stores/controlPlaneTypes.js';

export type AppShellViewSource = {
  dashboardCollapsed: boolean;
  eventsPanelCollapsed: boolean;
  gatewayStatus: StatusBadgeKind;
  tdlibStatus: StatusBadgeKind;
};

export function appShellView(source: AppShellViewSource): AppShellView {
  return {
    dashboardCollapsed: source.dashboardCollapsed,
    eventsPanelCollapsed: source.eventsPanelCollapsed,
    gatewayStatus: statusBadgeView('GATEWAY', source.gatewayStatus),
    tdlibStatus: statusBadgeView('TDLIB', source.tdlibStatus)
  };
}

function statusBadgeView(label: string, kind: StatusBadgeKind): StatusBadgeView {
  return {
    kind,
    label
  };
}
