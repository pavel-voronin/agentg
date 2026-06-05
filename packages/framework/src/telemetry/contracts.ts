export const TELEMETRY_RECORDS_EVENT_TYPE = 'telemetry.records.v1';
export const TELEMETRY_REPORT_EVENT_TYPE = 'telemetry.report.updated';
export const TELEMETRY_NATS_REPORT_EVENT_TYPE = 'telemetry.nats.updated';

export type TelemetryRecord = {
  at: string;
  detail?: Record<string, unknown>;
  durationMs: number;
  error?: string;
  kind: string;
  name: string;
  ok: boolean;
  source: string;
  version: 1;
};

export type TelemetryRecordBatch = {
  droppedRecordCount: number;
  records: TelemetryRecord[];
  source: string;
  version: 1;
};

export type TelemetryTotals = {
  avgMs: number;
  count: number;
  errorCount: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  totalMs: number;
};

export type TelemetryMetric = TelemetryTotals & {
  kind: string;
  lastAt: string | null;
  name: string;
  source: string;
};

export type TelemetrySlowRecord = {
  at: string;
  detail?: Record<string, unknown>;
  durationMs: number;
  error?: string;
  kind: string;
  name: string;
  ok: boolean;
  source: string;
};

type TelemetrySlowRecordGroup = {
  kind: string;
  records: TelemetrySlowRecord[];
};

export type TelemetryReport = {
  byKind: TelemetryMetric[];
  droppedRecordCount: number;
  enabled: boolean;
  errors: TelemetrySlowRecord[];
  generatedAt: string;
  generatedInMs: number;
  ignoredRecordCount: number;
  maxReportRecordLimit: number;
  operations: TelemetryMetric[];
  recordCount: number;
  reportRecordLimit: number;
  slowest: TelemetrySlowRecord[];
  slowestByKind: TelemetrySlowRecordGroup[];
  storage: string;
  storageFootprintBytes: number;
  storageSizeBytes: number;
  totals: TelemetryTotals;
  totalRecordCount: number;
  window: {
    firstAt: string | null;
    lastAt: string | null;
  };
};

export type NatsTelemetryPendingConnection = {
  cid: number;
  ip: string | null;
  name: string | null;
  pendingBytes: number;
  port: number | null;
  subscriptions: number;
};

export type NatsTelemetryReport = {
  connections: {
    active: number;
    leafnodes: number;
    remotes: number;
    routes: number;
    subscriptions: number;
    total: number;
  };
  endpoints: {
    connzMs: number | null;
    subszMs: number | null;
    varzMs: number | null;
  };
  error: string | null;
  generatedAt: string;
  generatedInMs: number;
  monitoringUrl: string;
  ok: boolean;
  pending: {
    connectionCount: number;
    maxBytes: number;
    top: NatsTelemetryPendingConnection[];
    totalBytes: number;
  };
  server: {
    cores: number;
    cpu: number;
    id: string | null;
    gomaxprocs: number;
    memoryBytes: number;
    name: string | null;
    slowConsumers: number;
    uptime: string | null;
    version: string | null;
  };
  subscriptions: {
    avgFanout: number | null;
    cacheHitRate: number | null;
    cacheSize: number | null;
    count: number;
    maxFanout: number | null;
  };
  traffic: {
    inBytes: number;
    inBytesPerSec: number | null;
    inMsgs: number;
    inMsgsPerSec: number | null;
    outBytes: number;
    outBytesPerSec: number | null;
    outMsgs: number;
    outMsgsPerSec: number | null;
  };
};
