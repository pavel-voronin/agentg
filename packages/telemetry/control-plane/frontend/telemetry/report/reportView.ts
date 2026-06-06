type ReportTotals = {
  avgMs: number;
  count: number;
  errorCount: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  totalMs: number;
};

type ReportMetric = ReportTotals & {
  kind: string;
  lastAt: string | null;
  name: string;
  source: string;
};

type SlowRecord = {
  at: string;
  detail?: Record<string, unknown>;
  durationMs: number;
  error?: string;
  kind: string;
  name: string;
  ok: boolean;
  source: string;
};

type SlowRecordGroup = {
  kind: string;
  records: SlowRecord[];
};

export type Report = {
  byKind: ReportMetric[];
  droppedRecordCount: number;
  enabled: boolean;
  errors: SlowRecord[];
  generatedAt: string;
  generatedInMs: number;
  ignoredRecordCount: number;
  maxReportRecordLimit: number;
  operations: ReportMetric[];
  recordCount: number;
  reportRecordLimit: number;
  slowest: SlowRecord[];
  slowestByKind: SlowRecordGroup[];
  storage: string;
  storageFootprintBytes: number;
  storageSizeBytes: number;
  totals: ReportTotals;
  totalRecordCount: number;
  window: {
    firstAt: string | null;
    lastAt: string | null;
  };
};

type SummaryCardView = {
  detail: string;
  label: string;
  value: string;
};

type SignalView = {
  detail: string;
  label: string;
  tone: 'bad' | 'neutral' | 'warn';
  value: string;
};

export type MetricRowView = {
  avg: string;
  count: string;
  errors: string;
  key: string;
  last: string;
  max: string;
  name: string;
  p50: string;
  p95: string;
  p99: string;
  source: string;
  total: string;
};

export type MetricSortKey =
  | 'avg'
  | 'count'
  | 'errors'
  | 'last'
  | 'max'
  | 'name'
  | 'p50'
  | 'p95'
  | 'p99'
  | 'total';

export type MetricSortDirection = 'asc' | 'desc';

export type MetricSort = {
  direction: MetricSortDirection;
  key: MetricSortKey;
};

export type ReportSorts = {
  database: MetricSort;
  rpc: MetricSort;
  update: MetricSort;
};

type SlowSampleView = {
  at: string;
  detail: string;
  key: string;
  name: string;
  ok: boolean;
  source: string;
  time: string;
};

export type PageView = {
  databaseRows: MetricRowView[];
  databaseSlowestRows: SlowSampleView[];
  droppedRecords: string;
  empty: boolean;
  errorRows: SlowSampleView[];
  generatedAt: string;
  generatedIn: string;
  ignoredRecords: string;
  maxReportRecordLimit: string;
  rpcRows: MetricRowView[];
  rpcSlowestRows: SlowSampleView[];
  signals: SignalView[];
  slowestRows: SlowSampleView[];
  storageFootprint: string;
  status: {
    label: string;
    tone: 'bad' | 'neutral' | 'ok' | 'warn';
  };
  summaryCards: SummaryCardView[];
  updateRows: MetricRowView[];
  updateSlowestRows: SlowSampleView[];
};

const TOP_ROW_LIMIT = 12;
const TOP_SIGNAL_LIMIT = 4;

const metricSortValues = {
  avg: (metric: ReportMetric) => metric.avgMs,
  count: (metric: ReportMetric) => metric.count,
  errors: (metric: ReportMetric) => metric.errorCount,
  last: (metric: ReportMetric) => metric.lastAt ?? '',
  max: (metric: ReportMetric) => metric.maxMs,
  name: (metric: ReportMetric) => metric.name,
  p50: (metric: ReportMetric) => metric.p50Ms,
  p95: (metric: ReportMetric) => metric.p95Ms,
  p99: (metric: ReportMetric) => metric.p99Ms,
  total: (metric: ReportMetric) => metric.totalMs
} satisfies Record<MetricSortKey, (metric: ReportMetric) => number | string>;

export function parseReport(value: unknown): Report {
  if (!isRecord(value)) {
    throw new Error('Telemetry report must be an object');
  }
  if (
    typeof value.enabled !== 'boolean' ||
    typeof value.droppedRecordCount !== 'number' ||
    typeof value.generatedInMs !== 'number' ||
    typeof value.generatedAt !== 'string' ||
    typeof value.ignoredRecordCount !== 'number' ||
    typeof value.maxReportRecordLimit !== 'number' ||
    typeof value.recordCount !== 'number' ||
    typeof value.reportRecordLimit !== 'number' ||
    typeof value.storage !== 'string' ||
    typeof value.storageFootprintBytes !== 'number' ||
    typeof value.storageSizeBytes !== 'number' ||
    typeof value.totalRecordCount !== 'number' ||
    !isRecord(value.totals) ||
    !isRecord(value.window) ||
    !Array.isArray(value.byKind) ||
    !Array.isArray(value.errors) ||
    !Array.isArray(value.operations) ||
    !Array.isArray(value.slowest) ||
    !Array.isArray(value.slowestByKind)
  ) {
    throw new Error('Telemetry report shape is invalid');
  }

  return {
    byKind: value.byKind.map(parseMetric),
    droppedRecordCount: value.droppedRecordCount,
    enabled: value.enabled,
    errors: value.errors.map(parseSlowRecord),
    generatedAt: value.generatedAt,
    generatedInMs: value.generatedInMs,
    ignoredRecordCount: value.ignoredRecordCount,
    maxReportRecordLimit: value.maxReportRecordLimit,
    operations: value.operations.map(parseMetric),
    recordCount: value.recordCount,
    reportRecordLimit: value.reportRecordLimit,
    slowest: value.slowest.map(parseSlowRecord),
    slowestByKind: value.slowestByKind.map(parseSlowRecordGroup),
    storage: value.storage,
    storageFootprintBytes: value.storageFootprintBytes,
    storageSizeBytes: value.storageSizeBytes,
    totals: parseTotals(value.totals),
    totalRecordCount: value.totalRecordCount,
    window: {
      firstAt: typeof value.window.firstAt === 'string' ? value.window.firstAt : null,
      lastAt: typeof value.window.lastAt === 'string' ? value.window.lastAt : null
    }
  };
}

export function reportPageView(report: Report | null, sorts: ReportSorts): PageView {
  if (report === null) {
    return emptyPageView();
  }

  const updateMetrics = metricsByKind(report, 'ingestion.update');
  const databaseMetrics = metricsByKind(report, 'postgres.query');
  const rpcMetrics = report.operations.filter((metric) => metric.kind.includes('rpc'));
  const errorCount = report.totals.errorCount;
  return {
    databaseRows: sortMetrics(databaseMetrics, sorts.database)
      .slice(0, TOP_ROW_LIMIT)
      .map(metricRowView),
    databaseSlowestRows: slowestRowsByKind(report, (kind) => kind === 'postgres.query').map(
      slowSampleView
    ),
    droppedRecords: formatInteger(report.droppedRecordCount),
    empty: report.recordCount === 0,
    errorRows: report.errors.slice(0, TOP_ROW_LIMIT).map(slowSampleView),
    generatedAt: formatDateTime(report.generatedAt),
    generatedIn: formatMs(report.generatedInMs),
    ignoredRecords: formatInteger(report.ignoredRecordCount),
    maxReportRecordLimit: formatInteger(report.maxReportRecordLimit),
    rpcRows: sortMetrics(rpcMetrics, sorts.rpc).slice(0, TOP_ROW_LIMIT).map(metricRowView),
    rpcSlowestRows: slowestRowsByKind(report, (kind) => kind.includes('rpc')).map(slowSampleView),
    signals: reportSignals(report, updateMetrics, databaseMetrics),
    slowestRows: report.slowest.slice(0, TOP_ROW_LIMIT).map(slowSampleView),
    storageFootprint: formatBytes(report.storageFootprintBytes),
    status: {
      label: report.enabled ? 'Live' : 'Off',
      tone: report.enabled ? 'ok' : 'neutral'
    },
    summaryCards: [
      {
        detail: `window ${formatInteger(report.recordCount)} / limit ${formatInteger(report.reportRecordLimit)}`,
        label: 'Stored records',
        value: formatInteger(report.totalRecordCount)
      },
      {
        detail: `db ${formatBytes(report.storageSizeBytes)} / ${report.storage}`,
        label: 'Storage',
        value: formatBytes(report.storageFootprintBytes)
      },
      {
        detail: `max ${formatInteger(report.maxReportRecordLimit)}`,
        label: 'Report window',
        value: formatInteger(report.reportRecordLimit)
      },
      {
        detail: `p50 ${formatMs(report.totals.p50Ms)} / p99 ${formatMs(report.totals.p99Ms)}`,
        label: 'Window latency',
        value: `p95 ${formatMs(report.totals.p95Ms)}`
      },
      {
        detail: `max ${formatMs(report.totals.maxMs)}`,
        label: 'Total time',
        value: formatMs(report.totals.totalMs)
      },
      {
        detail: errorCount === 0 ? 'all recorded operations completed' : 'check failed rows',
        label: 'Errors',
        value: formatInteger(errorCount)
      },
      {
        detail: `ignored ${formatInteger(report.ignoredRecordCount)}`,
        label: 'Dropped',
        value: formatInteger(report.droppedRecordCount)
      }
    ],
    updateRows: sortMetrics(updateMetrics, sorts.update).slice(0, TOP_ROW_LIMIT).map(metricRowView),
    updateSlowestRows: slowestRowsByKind(report, (kind) => kind === 'ingestion.update').map(
      slowSampleView
    )
  };
}

function emptyPageView(): PageView {
  return {
    databaseRows: [],
    databaseSlowestRows: [],
    droppedRecords: '0',
    empty: true,
    errorRows: [],
    generatedAt: '-',
    generatedIn: '-',
    ignoredRecords: '0',
    maxReportRecordLimit: '-',
    rpcRows: [],
    rpcSlowestRows: [],
    signals: [],
    slowestRows: [],
    storageFootprint: '-',
    status: {
      label: 'Loading',
      tone: 'warn'
    },
    summaryCards: [
      { detail: '-', label: 'Stored records', value: '-' },
      { detail: '-', label: 'Storage', value: '-' },
      { detail: '-', label: 'Report window', value: '-' },
      { detail: '-', label: 'Window latency', value: '-' },
      { detail: '-', label: 'Total time', value: '-' },
      { detail: '-', label: 'Errors', value: '-' },
      { detail: '-', label: 'Dropped', value: '-' }
    ],
    updateRows: [],
    updateSlowestRows: []
  };
}

function reportSignals(
  report: Report,
  updateMetrics: readonly ReportMetric[],
  databaseMetrics: readonly ReportMetric[]
): SignalView[] {
  const signals: SignalView[] = [];
  const slowestUpdate = updateMetrics.toSorted(compareMetricLatency)[0];
  const mostExpensiveUpdate = updateMetrics.toSorted(compareMetricCost)[0];
  const mostExpensiveQuery = databaseMetrics.toSorted(compareMetricCost)[0];
  const slowestQuery = databaseMetrics.toSorted(compareMetricLatency)[0];

  if (slowestUpdate !== undefined) {
    signals.push({
      detail: `${formatInteger(slowestUpdate.count)} calls / total ${formatMs(slowestUpdate.totalMs)}`,
      label: 'Slowest update handler',
      tone: slowestUpdate.p95Ms >= 1000 ? 'bad' : 'warn',
      value: `${slowestUpdate.name} p95 ${formatMs(slowestUpdate.p95Ms)}`
    });
  }
  if (mostExpensiveUpdate !== undefined && mostExpensiveUpdate.name !== slowestUpdate?.name) {
    signals.push({
      detail: `p95 ${formatMs(mostExpensiveUpdate.p95Ms)} / ${formatInteger(mostExpensiveUpdate.count)} calls`,
      label: 'Largest update cost',
      tone: 'warn',
      value: `${mostExpensiveUpdate.name} ${formatMs(mostExpensiveUpdate.totalMs)}`
    });
  }
  if (mostExpensiveQuery !== undefined) {
    signals.push({
      detail: `p95 ${formatMs(mostExpensiveQuery.p95Ms)} / ${formatInteger(mostExpensiveQuery.count)} calls`,
      label: 'Largest DB cost',
      tone: mostExpensiveQuery.p95Ms >= 500 ? 'warn' : 'neutral',
      value: `${shortenName(mostExpensiveQuery.name)} ${formatMs(mostExpensiveQuery.totalMs)}`
    });
  }
  if (slowestQuery !== undefined && slowestQuery.name !== mostExpensiveQuery?.name) {
    signals.push({
      detail: `${formatInteger(slowestQuery.count)} calls / total ${formatMs(slowestQuery.totalMs)}`,
      label: 'Slowest DB query group',
      tone: slowestQuery.p95Ms >= 500 ? 'warn' : 'neutral',
      value: `${shortenName(slowestQuery.name)} p95 ${formatMs(slowestQuery.p95Ms)}`
    });
  }
  if (report.totals.errorCount > 0) {
    signals.push({
      detail: 'recorded operations with ok=false',
      label: 'Failures',
      tone: 'bad',
      value: formatInteger(report.totals.errorCount)
    });
  }

  return signals.slice(0, TOP_SIGNAL_LIMIT);
}

function metricsByKind(report: Report, kind: string): ReportMetric[] {
  return report.operations.filter((metric) => metric.kind === kind);
}

function sortMetrics(metrics: readonly ReportMetric[], sort: MetricSort): ReportMetric[] {
  return metrics.toSorted((left, right) => compareMetricBySort(left, right, sort));
}

function slowestRowsByKind(report: Report, includeKind: (kind: string) => boolean): SlowRecord[] {
  return report.slowestByKind
    .filter((group) => includeKind(group.kind))
    .flatMap((group) => group.records)
    .toSorted((left, right) => right.durationMs - left.durationMs)
    .slice(0, TOP_ROW_LIMIT);
}

function compareMetricBySort(left: ReportMetric, right: ReportMetric, sort: MetricSort): number {
  const leftValue = metricSortValues[sort.key](left);
  const rightValue = metricSortValues[sort.key](right);
  const primary = compareSortValue(leftValue, rightValue);
  const directed = sort.direction === 'asc' ? primary : -primary;
  return directed || compareMetricIdentity(left, right);
}

function compareSortValue(left: number | string, right: number | string): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

function compareMetricIdentity(left: ReportMetric, right: ReportMetric): number {
  return (
    left.kind.localeCompare(right.kind) ||
    left.source.localeCompare(right.source) ||
    left.name.localeCompare(right.name)
  );
}

function metricRowView(metric: ReportMetric): MetricRowView {
  return {
    avg: formatMs(metric.avgMs),
    count: formatInteger(metric.count),
    errors: formatInteger(metric.errorCount),
    key: `${metric.kind}:${metric.source}:${metric.name}`,
    last: formatDateTime(metric.lastAt),
    max: formatMs(metric.maxMs),
    name: shortenName(metric.name),
    p50: formatMs(metric.p50Ms),
    p95: formatMs(metric.p95Ms),
    p99: formatMs(metric.p99Ms),
    source: `${metric.kind} / ${metric.source}`,
    total: formatMs(metric.totalMs)
  };
}

function parseSlowRecordGroup(value: unknown): SlowRecordGroup {
  if (!isRecord(value) || typeof value.kind !== 'string' || !Array.isArray(value.records)) {
    throw new Error('Telemetry slow record group shape is invalid');
  }

  return {
    kind: value.kind,
    records: value.records.map(parseSlowRecord)
  };
}

function slowSampleView(record: SlowRecord, index: number): SlowSampleView {
  return {
    at: formatDateTime(record.at),
    detail: slowSampleDetail(record),
    key: `${record.at}:${record.kind}:${record.source}:${record.name}:${String(index)}`,
    name: shortenName(record.name),
    ok: record.ok,
    source: `${record.kind} / ${record.source}`,
    time: formatMs(record.durationMs)
  };
}

function slowSampleDetail(record: SlowRecord): string {
  if (record.error !== undefined) {
    return record.error;
  }
  if (record.detail !== undefined) {
    const operation = typeof record.detail.operation === 'string' ? record.detail.operation : null;
    const relations = Array.isArray(record.detail.relations)
      ? record.detail.relations.filter((relation) => typeof relation === 'string')
      : [];
    if (operation !== null && relations.length > 0) {
      return `${operation} ${relations.join(', ')}`;
    }
    if (operation !== null) {
      return operation;
    }
  }
  return record.ok ? 'completed' : 'failed';
}

function parseMetric(value: unknown): ReportMetric {
  if (
    !isRecord(value) ||
    typeof value.kind !== 'string' ||
    (typeof value.lastAt !== 'string' && value.lastAt !== null) ||
    typeof value.name !== 'string' ||
    typeof value.source !== 'string'
  ) {
    throw new Error('Telemetry metric shape is invalid');
  }

  return {
    ...parseTotals(value),
    kind: value.kind,
    lastAt: value.lastAt,
    name: value.name,
    source: value.source
  };
}

function parseSlowRecord(value: unknown): SlowRecord {
  if (
    !isRecord(value) ||
    typeof value.at !== 'string' ||
    typeof value.durationMs !== 'number' ||
    typeof value.kind !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.ok !== 'boolean' ||
    typeof value.source !== 'string'
  ) {
    throw new Error('Telemetry slow record shape is invalid');
  }

  return {
    at: value.at,
    durationMs: value.durationMs,
    kind: value.kind,
    name: value.name,
    ok: value.ok,
    source: value.source,
    ...(isRecord(value.detail) ? { detail: value.detail } : {}),
    ...(typeof value.error === 'string' ? { error: value.error } : {})
  };
}

function parseTotals(value: Record<string, unknown>): ReportTotals {
  if (
    typeof value.avgMs !== 'number' ||
    typeof value.count !== 'number' ||
    typeof value.errorCount !== 'number' ||
    typeof value.maxMs !== 'number' ||
    typeof value.p50Ms !== 'number' ||
    typeof value.p95Ms !== 'number' ||
    typeof value.p99Ms !== 'number' ||
    typeof value.totalMs !== 'number'
  ) {
    throw new Error('Telemetry totals shape is invalid');
  }

  return {
    avgMs: value.avgMs,
    count: value.count,
    errorCount: value.errorCount,
    maxMs: value.maxMs,
    p50Ms: value.p50Ms,
    p95Ms: value.p95Ms,
    p99Ms: value.p99Ms,
    totalMs: value.totalMs
  };
}

function compareMetricLatency(left: ReportMetric, right: ReportMetric): number {
  return (
    right.p95Ms - left.p95Ms ||
    right.p99Ms - left.p99Ms ||
    right.maxMs - left.maxMs ||
    right.totalMs - left.totalMs ||
    left.name.localeCompare(right.name)
  );
}

function compareMetricCost(left: ReportMetric, right: ReportMetric): number {
  return (
    right.totalMs - left.totalMs ||
    right.count - left.count ||
    right.p95Ms - left.p95Ms ||
    left.name.localeCompare(right.name)
  );
}

function formatMs(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }
  if (value >= 60_000) {
    return `${(value / 60_000).toFixed(1)}m`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}s`;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)}ms`;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let scaled = value;
  let unitIndex = 0;
  while (scaled >= 1024 && unitIndex < units.length - 1) {
    scaled /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 || Number.isInteger(scaled) || scaled >= 10 ? 0 : 1;
  return `${scaled.toFixed(digits)} ${units[unitIndex] ?? 'B'}`;
}

function formatDateTime(value: string | null): string {
  if (value === null) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit'
  }).format(date);
}

function shortenName(value: string): string {
  return value.length > 72 ? `${value.slice(0, 69)}...` : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
