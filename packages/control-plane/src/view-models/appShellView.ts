import type {
  AppShellView,
  StatusBadgeKind,
  StatusBadgeView
} from '../stores/controlPlaneTypes.js';

export type AppShellViewSource = {
  controlPlaneStatus: StatusBadgeKind;
  dashboardCollapsed: boolean;
  eventsPanelCollapsed: boolean;
  slotDebugEnabled: boolean;
};

export function appShellView(source: AppShellViewSource): AppShellView {
  return {
    controlPlaneStatus: statusBadgeView('CONTROL', source.controlPlaneStatus),
    dashboardCollapsed: source.dashboardCollapsed,
    eventsPanelCollapsed: source.eventsPanelCollapsed,
    slotDebugEnabled: source.slotDebugEnabled
  };
}

function statusBadgeView(label: string, kind: StatusBadgeKind): StatusBadgeView {
  return {
    kind,
    label
  };
}
