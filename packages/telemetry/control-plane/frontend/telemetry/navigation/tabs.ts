import { computed, ref, watch, type ComputedRef } from 'vue';
import { slotRoute, type ContentDefinition } from '@agentg/framework/cp';

import { TAB_SLOT_ID } from '../contracts.js';
import { parseTelemetryStatusSourceRegistration } from '../status/statusSources.js';
import type { MetricPanelId, MetricTableId, ReportTabId, ReportTabView } from '../types.js';

type RouteState = ReturnType<typeof slotRoute>;
type SlotRuntime = {
  compatibleContent(tags: readonly string[]): readonly ContentDefinition[];
};

const builtInReportTabs: readonly ReportTabView[] = [
  { id: 'overview', label: 'Overview', order: 10, statusSource: null },
  { id: 'update', label: 'Updates', order: 20, statusSource: null },
  { id: 'database', label: 'Database', order: 30, statusSource: null },
  { id: 'rpc', label: 'RPC', order: 40, statusSource: null },
  { id: 'errors', label: 'Errors', order: 50, statusSource: null },
  { id: 'slowest', label: 'Slowest', order: 60, statusSource: null },
  { id: 'nats', label: 'NATS', order: 70, statusSource: null }
];

export function useTelemetryTabs(input: {
  route: ComputedRef<RouteState>;
  slotRuntime: SlotRuntime;
}): {
  activeExternalTab: ComputedRef<ReportTabView | null>;
  activeExternalTabSlotTag: ComputedRef<string>;
  activeMetricPanel: ComputedRef<MetricPanelId>;
  activeTab: ComputedRef<ReportTabId>;
  activeTabRoute: ComputedRef<RouteState>;
  externalTabs: ComputedRef<ReportTabView[]>;
  reportTabs: ComputedRef<ReportTabView[]>;
  selectMetricPanel: (panelId: MetricPanelId) => void;
  selectTab: (tabId: ReportTabId) => void;
} {
  const activeTabState = ref<ReportTabId>('overview');
  const routeSegments = computed(() => input.route.value.segments);
  const activeTabRoute = computed(() => input.route.value.child(1));
  const externalTabs = computed(() =>
    tabContributions(input.slotRuntime.compatibleContent([TAB_SLOT_ID]))
  );
  const reportTabs = computed(() =>
    [...builtInReportTabs, ...externalTabs.value].sort(compareReportTabs)
  );
  const activeTab = computed(() => activeTabState.value);
  const activeExternalTab = computed(
    () => externalTabs.value.find((tab) => tab.id === activeTab.value) ?? null
  );
  const activeExternalTabSlotTag = computed(() =>
    activeExternalTab.value === null ? '' : tabSlotTag(activeExternalTab.value.id)
  );
  const activeMetricPanel = computed<MetricPanelId>(() => {
    const panel = activeTabRoute.value.segment(0);
    return panel === 'samples' ? 'samples' : 'metrics';
  });

  watch(
    routeSegments,
    (segments) => {
      activeTabState.value = tabFromRouteSegments(segments);
    },
    { immediate: true }
  );

  function selectTab(tabId: ReportTabId): void {
    activeTabState.value = tabId;
    input.route.value.replace(routeSegmentsForTab(tabId));
  }

  function selectMetricPanel(panelId: MetricPanelId): void {
    const tableId = metricTableId(activeTab.value);
    if (tableId === null) {
      return;
    }
    input.route.value.replace(metricPanelRouteSegments(tableId, panelId));
  }

  return {
    activeExternalTab,
    activeExternalTabSlotTag,
    activeMetricPanel,
    activeTab,
    activeTabRoute,
    externalTabs,
    reportTabs,
    selectMetricPanel,
    selectTab
  };
}

export function metricTableId(tabId: ReportTabId): MetricTableId | null {
  if (tabId === 'database' || tabId === 'rpc' || tabId === 'update') {
    return tabId;
  }
  return null;
}

function tabFromRouteSegments(segments: readonly string[]): ReportTabId {
  const [tab] = segments;
  return typeof tab === 'string' && tab.trim().length > 0 ? tab : 'overview';
}

function routeSegmentsForTab(tabId: ReportTabId): string[] {
  return tabId === 'overview' ? [] : [tabId];
}

function metricPanelRouteSegments(tableId: MetricTableId, panelId: MetricPanelId): string[] {
  return panelId === 'metrics' ? [tableId] : [tableId, panelId];
}

function tabContributions(contents: readonly ContentDefinition[]): ReportTabView[] {
  return contents.map(tabContribution).filter((tab): tab is ReportTabView => tab !== null);
}

function tabContribution(content: ContentDefinition): ReportTabView | null {
  const metadata = isRecord(content.metadata) ? content.metadata : {};
  const tab = isRecord(metadata.telemetryTab) ? metadata.telemetryTab : null;
  if (tab === null) {
    return null;
  }

  const id = tabIdString(tab.tabId);
  const label = nonEmptyString(tab.label);
  if (id === null || label === null) {
    return null;
  }

  return {
    id,
    label,
    order: finiteNumber(tab.order) ?? 100,
    statusSource: parseTelemetryStatusSourceRegistration(tab.statusSource)
  };
}

function compareReportTabs(left: ReportTabView, right: ReportTabView): number {
  if (left.order !== right.order) {
    return left.order - right.order;
  }
  return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
}

function tabSlotTag(tabId: string): string {
  return `${TAB_SLOT_ID}.${tabId}`;
}

function tabIdString(value: unknown): string | null {
  const tabId = nonEmptyString(value);
  if (tabId === null || tabId.includes('/')) {
    return null;
  }
  return tabId;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
