import type { ComputedRef } from 'vue';

export type DashboardMetric = {
  detail?: string;
  label: string;
  value: string;
};

export type AppEventItem = {
  color: string;
  dataJson: string;
  key: string;
  occurredAt: string;
  type: string;
};

export function useControlPlaneAppView(): {
  dashboardMetrics: ComputedRef<DashboardMetric[]>;
  eventItems: ComputedRef<AppEventItem[]>;
  hasEvents: ComputedRef<boolean>;
};

export function mountControlPlaneAppRuntime(): void;
