import { computed, ref, type ComputedRef, type Ref } from 'vue';

import { REPORT_PROCEDURE, RESET_PROCEDURE } from '../contracts.js';
import { parseReport, reportPageView, type Report, type ReportSorts } from './reportView.js';
import type { MetricTableId, ReportRequestMode } from '../types.js';
import type { MetricSortKey, MetricSortDirection, PageView } from './reportView.js';

type ReportHost = {
  rpc(procedure: string, input?: unknown): Promise<unknown>;
};

type SourceMarkers = {
  markSourceAccepted(
    sourceId: string,
    details?: { generatedAt?: string | undefined; generatedInMs?: number | undefined }
  ): void;
  markSourceError(
    sourceId: string,
    error: string,
    details?: { generatedAt?: string | undefined; generatedInMs?: number | undefined }
  ): void;
};

export function useTelemetryReport(
  host: ReportHost,
  sources: SourceMarkers
): {
  acceptReport: (value: unknown) => void;
  applyReportWindow: () => Promise<void>;
  cancelReset: () => void;
  changeMetricSort: (tableId: MetricTableId, key: MetricSortKey) => void;
  error: Ref<string | null>;
  loadReport: (input?: unknown) => Promise<void>;
  loading: Ref<boolean>;
  recordLimitInput: Ref<string>;
  report: Ref<Report | null>;
  reportSorts: Ref<ReportSorts>;
  requestMode: Ref<ReportRequestMode>;
  requestReset: () => void;
  resetConfirmOpen: Ref<boolean>;
  resetReport: () => Promise<void>;
  useLiveReport: () => Promise<void>;
  view: ComputedRef<PageView>;
} {
  const report = ref<Report | null>(null);
  const error = ref<string | null>(null);
  const loading = ref(false);
  const recordLimitInput = ref('');
  const requestMode = ref<ReportRequestMode>('live');
  const resetConfirmOpen = ref(false);
  const reportSorts = ref<ReportSorts>({
    database: { direction: 'desc', key: 'total' },
    rpc: { direction: 'desc', key: 'p95' },
    update: { direction: 'desc', key: 'p95' }
  });
  const view = computed(() => reportPageView(report.value, reportSorts.value));

  async function loadReport(input: unknown = reportInput()): Promise<void> {
    loading.value = true;
    try {
      acceptReport(await host.rpc(REPORT_PROCEDURE, input));
    } catch (loadError) {
      const message = errorMessage(loadError);
      error.value = message;
      sources.markSourceError('telemetry.report', message);
    } finally {
      loading.value = false;
    }
  }

  function acceptReport(value: unknown): void {
    const parsed = parseReport(value);
    report.value = parsed;
    if (recordLimitInput.value.length === 0) {
      recordLimitInput.value = String(parsed.reportRecordLimit);
    }
    error.value = null;
    sources.markSourceAccepted('telemetry.report', {
      generatedAt: parsed.generatedAt,
      generatedInMs: parsed.generatedInMs
    });
  }

  async function applyReportWindow(): Promise<void> {
    const recordLimit = Number(recordLimitInput.value);
    if (!Number.isFinite(recordLimit) || recordLimit <= 0) {
      error.value = 'Report window must be a positive number';
      return;
    }
    requestMode.value = 'custom';
    await loadReport({ recordLimit });
  }

  function requestReset(): void {
    resetConfirmOpen.value = true;
  }

  function cancelReset(): void {
    resetConfirmOpen.value = false;
  }

  async function resetReport(): Promise<void> {
    loading.value = true;
    try {
      requestMode.value = 'live';
      recordLimitInput.value = '';
      acceptReport(await host.rpc(RESET_PROCEDURE));
      resetConfirmOpen.value = false;
    } catch (resetError) {
      error.value = errorMessage(resetError);
    } finally {
      loading.value = false;
    }
  }

  async function useLiveReport(): Promise<void> {
    requestMode.value = 'live';
    await loadReport({});
  }

  function changeMetricSort(tableId: MetricTableId, key: MetricSortKey): void {
    const current = reportSorts.value[tableId];
    reportSorts.value = {
      ...reportSorts.value,
      [tableId]: {
        direction: nextSortDirection(current, key),
        key
      }
    };
  }

  function reportInput(): { recordLimit?: number } {
    if (requestMode.value === 'custom') {
      const recordLimit = Number(recordLimitInput.value);
      if (Number.isFinite(recordLimit) && recordLimit > 0) {
        return { recordLimit };
      }
    }
    return {};
  }

  return {
    acceptReport,
    applyReportWindow,
    cancelReset,
    changeMetricSort,
    error,
    loadReport,
    loading,
    recordLimitInput,
    report,
    reportSorts,
    requestMode,
    requestReset,
    resetConfirmOpen,
    resetReport,
    useLiveReport,
    view
  };
}

function nextSortDirection(
  current: { direction: MetricSortDirection; key: MetricSortKey },
  key: MetricSortKey
): MetricSortDirection {
  return current.key === key && current.direction === 'desc' ? 'asc' : 'desc';
}

function errorMessage(errorValue: unknown): string {
  return errorValue instanceof Error ? errorValue.message : String(errorValue);
}
