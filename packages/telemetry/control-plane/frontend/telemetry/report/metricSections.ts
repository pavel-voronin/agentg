import type { ComputedRef } from 'vue';
import { computed } from 'vue';

import type { PageView } from './reportView.js';
import { metricTableId } from '../navigation/tabs.js';
import type { MetricSectionView, ReportTabId } from '../types.js';

export function useTelemetryMetricSections(input: {
  activeTab: ComputedRef<ReportTabId>;
  view: ComputedRef<PageView>;
}): {
  activeMetricSection: ComputedRef<MetricSectionView | null>;
  activeSlowestRows: ComputedRef<PageView['slowestRows']>;
  activeSlowestTitle: ComputedRef<string>;
  metricSections: ComputedRef<MetricSectionView[]>;
} {
  const metricSections = computed<MetricSectionView[]>(() => [
    {
      emptyLabel: 'No update records',
      firstColumnLabel: 'Handler',
      id: 'update',
      rows: input.view.value.updateRows,
      title: 'Slow Update Handlers'
    },
    {
      emptyLabel: 'No database records',
      firstColumnLabel: 'Query group',
      id: 'database',
      rows: input.view.value.databaseRows,
      title: 'Database Hotspots'
    },
    {
      emptyLabel: 'No RPC records',
      firstColumnLabel: 'Procedure',
      id: 'rpc',
      rows: input.view.value.rpcRows,
      title: 'RPC Calls'
    }
  ]);
  const activeMetricSection = computed<MetricSectionView | null>(() => {
    const tableId = metricTableId(input.activeTab.value);
    if (tableId === null) {
      return null;
    }
    return metricSections.value.find((section) => section.id === tableId) ?? null;
  });
  const activeSlowestRows = computed(() => {
    switch (input.activeTab.value) {
      case 'database':
        return input.view.value.databaseSlowestRows;
      case 'errors':
        return input.view.value.errorRows;
      case 'rpc':
        return input.view.value.rpcSlowestRows;
      case 'slowest':
        return input.view.value.slowestRows;
      case 'update':
        return input.view.value.updateSlowestRows;
      case 'nats':
      case 'overview':
        return [];
      default:
        return [];
    }
  });
  const activeSlowestTitle = computed(() => {
    switch (input.activeTab.value) {
      case 'database':
        return 'Slowest Database Samples';
      case 'errors':
        return 'Recent Error Samples';
      case 'rpc':
        return 'Slowest RPC Samples';
      case 'slowest':
        return 'Global Slowest Samples';
      case 'update':
        return 'Slowest Update Samples';
      case 'nats':
      case 'overview':
        return '';
      default:
        return '';
    }
  });

  return {
    activeMetricSection,
    activeSlowestRows,
    activeSlowestTitle,
    metricSections
  };
}
