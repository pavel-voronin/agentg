type NatsPendingConnection = {
  cid: number;
  ip: string | null;
  name: string | null;
  pendingBytes: number;
  port: number | null;
  subscriptions: number;
};

export type NatsReport = {
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
    top: NatsPendingConnection[];
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

type NatsTone = 'bad' | 'neutral' | 'ok' | 'warn';

type NatsCardView = {
  detail: string;
  label: string;
  tone: NatsTone;
  tooltip: string | null;
  value: string;
};

type NatsRowView = {
  detail: string;
  key: string;
  label: string;
  tone: NatsTone;
  tooltip: string | null;
  value: string;
};

type NatsPendingRowView = {
  address: string;
  key: string;
  name: string;
  pending: string;
  pendingTone: NatsTone;
  pendingTooltip: string | null;
  subscriptions: string;
};

export type NatsPageView = {
  endpointRows: NatsRowView[];
  error: string | null;
  generatedAt: string;
  generatedIn: string;
  monitoringUrl: string;
  pendingRows: NatsPendingRowView[];
  status: {
    label: string;
    tone: NatsTone;
  };
  summaryCards: NatsCardView[];
  trafficRows: NatsRowView[];
};

const ENDPOINT_BAD_MS = 1000;
const ENDPOINT_WARN_MS = 500;

export function parseNatsReport(value: unknown): NatsReport {
  if (!isRecord(value)) {
    throw new Error('NATS telemetry report must be an object');
  }
  const connections = requiredRecord(value.connections, 'NATS connections');
  const endpoints = requiredRecord(value.endpoints, 'NATS endpoints');
  const pending = requiredRecord(value.pending, 'NATS pending');
  const server = requiredRecord(value.server, 'NATS server');
  const subscriptions = requiredRecord(value.subscriptions, 'NATS subscriptions');
  const traffic = requiredRecord(value.traffic, 'NATS traffic');

  if (
    typeof value.generatedAt !== 'string' ||
    typeof value.generatedInMs !== 'number' ||
    typeof value.monitoringUrl !== 'string' ||
    typeof value.ok !== 'boolean' ||
    (typeof value.error !== 'string' && value.error !== null) ||
    !Array.isArray(pending.top)
  ) {
    throw new Error('NATS telemetry report shape is invalid');
  }

  return {
    connections: {
      active: requiredNumber(connections.active),
      leafnodes: requiredNumber(connections.leafnodes),
      remotes: requiredNumber(connections.remotes),
      routes: requiredNumber(connections.routes),
      subscriptions: requiredNumber(connections.subscriptions),
      total: requiredNumber(connections.total)
    },
    endpoints: {
      connzMs: nullableNumber(endpoints.connzMs),
      subszMs: nullableNumber(endpoints.subszMs),
      varzMs: nullableNumber(endpoints.varzMs)
    },
    error: value.error,
    generatedAt: value.generatedAt,
    generatedInMs: value.generatedInMs,
    monitoringUrl: value.monitoringUrl,
    ok: value.ok,
    pending: {
      connectionCount: requiredNumber(pending.connectionCount),
      maxBytes: requiredNumber(pending.maxBytes),
      top: pending.top.map(parsePendingConnection),
      totalBytes: requiredNumber(pending.totalBytes)
    },
    server: {
      cores: requiredNumber(server.cores),
      cpu: requiredNumber(server.cpu),
      id: nullableString(server.id),
      gomaxprocs: requiredNumber(server.gomaxprocs),
      memoryBytes: requiredNumber(server.memoryBytes),
      name: nullableString(server.name),
      slowConsumers: requiredNumber(server.slowConsumers),
      uptime: nullableString(server.uptime),
      version: nullableString(server.version)
    },
    subscriptions: {
      avgFanout: nullableNumber(subscriptions.avgFanout),
      cacheHitRate: nullableNumber(subscriptions.cacheHitRate),
      cacheSize: nullableNumber(subscriptions.cacheSize),
      count: requiredNumber(subscriptions.count),
      maxFanout: nullableNumber(subscriptions.maxFanout)
    },
    traffic: {
      inBytes: requiredNumber(traffic.inBytes),
      inBytesPerSec: nullableNumber(traffic.inBytesPerSec),
      inMsgs: requiredNumber(traffic.inMsgs),
      inMsgsPerSec: nullableNumber(traffic.inMsgsPerSec),
      outBytes: requiredNumber(traffic.outBytes),
      outBytesPerSec: nullableNumber(traffic.outBytesPerSec),
      outMsgs: requiredNumber(traffic.outMsgs),
      outMsgsPerSec: nullableNumber(traffic.outMsgsPerSec)
    }
  };
}

export function natsPageView(report: NatsReport | null): NatsPageView {
  if (report === null) {
    return emptyNatsPageView();
  }

  return {
    endpointRows: endpointRows(report),
    error: report.error,
    generatedAt: formatDateTime(report.generatedAt),
    generatedIn: formatMs(report.generatedInMs),
    monitoringUrl: report.monitoringUrl,
    pendingRows: report.pending.top.map(pendingRowView),
    status: {
      label: report.ok ? 'Monitoring' : 'Monitoring error',
      tone: report.ok ? 'ok' : 'bad'
    },
    summaryCards: [
      {
        detail: `${report.server.name ?? 'server'} ${report.server.version ?? ''}`.trim(),
        label: 'Server',
        tone: report.ok ? 'neutral' : 'bad',
        tooltip: report.ok ? null : 'NATS monitoring did not return a complete report.',
        value: report.server.uptime ?? '-'
      },
      {
        detail: `${formatInteger(report.server.cores)} cores / gomaxprocs ${formatInteger(report.server.gomaxprocs)}`,
        label: 'CPU',
        tone: 'neutral',
        tooltip: null,
        value: `${formatNumber(report.server.cpu)}%`
      },
      {
        detail: report.monitoringUrl,
        label: 'Memory',
        tone: 'neutral',
        tooltip: null,
        value: formatBytes(report.server.memoryBytes)
      },
      {
        detail: `total ${formatInteger(report.connections.total)}`,
        label: 'Connections',
        tone: report.connections.active === 0 ? 'bad' : 'ok',
        tooltip:
          report.connections.active === 0
            ? 'Running services are expected to keep active NATS connections.'
            : 'NATS has active client connections.',
        value: formatInteger(report.connections.active)
      },
      {
        detail: `cache ${formatOptionalInteger(report.subscriptions.cacheSize)} / hit ${formatOptionalPercent(report.subscriptions.cacheHitRate)}`,
        label: 'Subscriptions',
        tone: report.subscriptions.count === 0 ? 'bad' : 'ok',
        tooltip:
          report.subscriptions.count === 0
            ? 'Running services are expected to register NATS subscriptions.'
            : 'NATS has active subscriptions.',
        value: formatInteger(report.subscriptions.count)
      },
      {
        detail: `pending ${formatBytes(report.pending.totalBytes)} across ${formatInteger(report.pending.connectionCount)} connections`,
        label: 'Slow consumers',
        tone: slowConsumersTone(report),
        tooltip: slowConsumersTooltip(report),
        value: formatInteger(report.server.slowConsumers)
      }
    ],
    trafficRows: trafficRows(report)
  };
}

function emptyNatsPageView(): NatsPageView {
  return {
    endpointRows: [],
    error: null,
    generatedAt: '-',
    generatedIn: '-',
    monitoringUrl: '-',
    pendingRows: [],
    status: {
      label: 'Loading',
      tone: 'neutral'
    },
    summaryCards: [
      { detail: '-', label: 'Server', tone: 'neutral', tooltip: null, value: '-' },
      { detail: '-', label: 'CPU', tone: 'neutral', tooltip: null, value: '-' },
      { detail: '-', label: 'Memory', tone: 'neutral', tooltip: null, value: '-' },
      { detail: '-', label: 'Connections', tone: 'neutral', tooltip: null, value: '-' },
      { detail: '-', label: 'Subscriptions', tone: 'neutral', tooltip: null, value: '-' },
      { detail: '-', label: 'Slow consumers', tone: 'neutral', tooltip: null, value: '-' }
    ],
    trafficRows: []
  };
}

function trafficRows(report: NatsReport): NatsRowView[] {
  return [
    {
      detail: `${formatInteger(report.traffic.inMsgs)} total`,
      key: 'in-msgs',
      label: 'Inbound messages',
      tone: 'neutral',
      tooltip: null,
      value: formatOptionalRate(report.traffic.inMsgsPerSec)
    },
    {
      detail: `${formatInteger(report.traffic.outMsgs)} total`,
      key: 'out-msgs',
      label: 'Outbound messages',
      tone: 'neutral',
      tooltip: null,
      value: formatOptionalRate(report.traffic.outMsgsPerSec)
    },
    {
      detail: `${formatBytes(report.traffic.inBytes)} total`,
      key: 'in-bytes',
      label: 'Inbound bytes',
      tone: 'neutral',
      tooltip: null,
      value: formatOptionalByteRate(report.traffic.inBytesPerSec)
    },
    {
      detail: `${formatBytes(report.traffic.outBytes)} total`,
      key: 'out-bytes',
      label: 'Outbound bytes',
      tone: 'neutral',
      tooltip: null,
      value: formatOptionalByteRate(report.traffic.outBytesPerSec)
    },
    {
      detail: `max ${formatOptionalNumber(report.subscriptions.maxFanout)}`,
      key: 'fanout',
      label: 'Subscription fanout',
      tone: 'neutral',
      tooltip: null,
      value: formatOptionalNumber(report.subscriptions.avgFanout)
    },
    {
      detail: `max connection ${formatBytes(report.pending.maxBytes)}`,
      key: 'pending',
      label: 'Pending bytes',
      tone: pendingTone(report.pending.totalBytes),
      tooltip: pendingTooltip(report.pending.totalBytes),
      value: formatBytes(report.pending.totalBytes)
    }
  ];
}

function endpointRows(report: NatsReport): NatsRowView[] {
  return [
    {
      detail: 'server counters',
      key: 'varz',
      label: '/varz',
      tone: endpointTone(report.endpoints.varzMs),
      tooltip: endpointTooltip(report.endpoints.varzMs),
      value: formatOptionalMs(report.endpoints.varzMs)
    },
    {
      detail: 'connection pending bytes',
      key: 'connz',
      label: '/connz',
      tone: endpointTone(report.endpoints.connzMs),
      tooltip: endpointTooltip(report.endpoints.connzMs),
      value: formatOptionalMs(report.endpoints.connzMs)
    },
    {
      detail: 'subscription fanout',
      key: 'subsz',
      label: '/subsz',
      tone: endpointTone(report.endpoints.subszMs),
      tooltip: endpointTooltip(report.endpoints.subszMs),
      value: formatOptionalMs(report.endpoints.subszMs)
    }
  ];
}

function pendingRowView(row: NatsPendingConnection): NatsPendingRowView {
  return {
    address: `${row.ip ?? '-'}${row.port === null ? '' : `:${String(row.port)}`}`,
    key: String(row.cid),
    name: row.name ?? `cid ${String(row.cid)}`,
    pending: formatBytes(row.pendingBytes),
    pendingTone: pendingTone(row.pendingBytes),
    pendingTooltip: pendingTooltip(row.pendingBytes),
    subscriptions: formatInteger(row.subscriptions)
  };
}

function slowConsumersTone(report: NatsReport): NatsTone {
  if (report.server.slowConsumers > 0) {
    return 'bad';
  }
  return pendingTone(report.pending.totalBytes);
}

function slowConsumersTooltip(report: NatsReport): string {
  if (report.server.slowConsumers > 0) {
    return 'NATS slow consumers should stay at zero; consumers are not reading fast enough.';
  }
  if (report.pending.totalBytes > 0) {
    return 'Pending bytes indicate backpressure even before NATS counts a slow consumer.';
  }
  return 'No slow consumers or pending connection bytes.';
}

function pendingTone(bytes: number): NatsTone {
  return bytes > 0 ? 'warn' : 'ok';
}

function pendingTooltip(bytes: number): string {
  return bytes > 0
    ? 'Pending bytes mean at least one connection has unread data buffered in NATS.'
    : 'No pending connection bytes.';
}

function endpointTone(value: number | null): NatsTone {
  if (value === null || value >= ENDPOINT_BAD_MS) {
    return 'bad';
  }
  if (value >= ENDPOINT_WARN_MS) {
    return 'warn';
  }
  return 'ok';
}

function endpointTooltip(value: number | null): string {
  if (value === null) {
    return 'The NATS monitoring endpoint did not return data.';
  }
  if (value >= ENDPOINT_BAD_MS) {
    return 'NATS monitoring reads above 1s make telemetry too slow for diagnostics.';
  }
  if (value >= ENDPOINT_WARN_MS) {
    return 'NATS monitoring reads above 500ms deserve attention.';
  }
  return 'NATS monitoring endpoint is responding quickly.';
}

function parsePendingConnection(value: unknown): NatsPendingConnection {
  const row = requiredRecord(value, 'NATS pending connection');
  return {
    cid: requiredNumber(row.cid),
    ip: nullableString(row.ip),
    name: nullableString(row.name),
    pendingBytes: requiredNumber(row.pendingBytes),
    port: nullableNumber(row.port),
    subscriptions: requiredNumber(row.subscriptions)
  };
}

function formatMs(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}s`;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)}ms`;
}

function formatOptionalMs(value: number | null): string {
  return value === null ? '-' : formatMs(value);
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

function formatOptionalByteRate(value: number | null): string {
  return value === null ? '-' : `${formatBytes(value)}/s`;
}

function formatOptionalRate(value: number | null): string {
  return value === null ? '-' : `${formatNumber(value)}/s`;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function formatOptionalInteger(value: number | null): string {
  return value === null ? '-' : formatInteger(value);
}

function formatNumber(value: number): string {
  return Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : '-';
}

function formatOptionalNumber(value: number | null): string {
  return value === null ? '-' : formatNumber(value);
}

function formatOptionalPercent(value: number | null): string {
  return value === null ? '-' : `${formatNumber(value)}%`;
}

function formatDateTime(value: string): string {
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

function requiredRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${name} shape is invalid`);
  }
  return value;
}

function requiredNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('NATS telemetry number field is invalid');
  }
  return value;
}

function nullableNumber(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  return requiredNumber(value);
}

function nullableString(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error('NATS telemetry string field is invalid');
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
