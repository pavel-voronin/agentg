import { performance } from 'node:perf_hooks';

import type { NatsTelemetryPendingConnection, NatsTelemetryReport } from '@agentg/framework';

export type NatsMonitor = {
  readReport(): Promise<NatsTelemetryReport>;
};

type MonitorOptions = {
  fetchJson?: FetchJson;
  monitoringUrl: string;
  nowMs?: () => number;
  requestTimeoutMs: number;
};

type FetchJson = (url: URL, timeoutMs: number) => Promise<unknown>;

type TrafficSample = {
  atMs: number;
  inBytes: number;
  inMsgs: number;
  outBytes: number;
  outMsgs: number;
};

type MonitorState = {
  previousSample: TrafficSample | null;
};

type EndpointResult = {
  data: Record<string, unknown> | null;
  durationMs: number | null;
  error: string | null;
};

type EndpointName = 'connz' | 'subsz' | 'varz';

const PENDING_CONNECTION_LIMIT = 10;

export function createNatsMonitor(options: MonitorOptions): NatsMonitor {
  const state: MonitorState = {
    previousSample: null
  };
  const fetchJson = options.fetchJson ?? fetchEndpointJson;

  return {
    async readReport() {
      return readReport(options, fetchJson, state);
    }
  };
}

async function readReport(
  options: MonitorOptions,
  fetchJson: FetchJson,
  state: MonitorState
): Promise<NatsTelemetryReport> {
  const startedAt = performance.now();
  const generatedAt = new Date().toISOString();
  const baseUrl = normalizedMonitoringUrl(options.monitoringUrl);
  const varz = await readEndpoint(baseUrl, 'varz', options.requestTimeoutMs, fetchJson);

  if (varz.data === null) {
    return unavailableReport({
      baseUrl,
      endpoints: {
        connzMs: null,
        subszMs: null,
        varzMs: varz.durationMs
      },
      error: varz.error ?? 'NATS monitoring /varz failed',
      generatedAt,
      generatedInMs: generatedMilliseconds(startedAt)
    });
  }

  const [connz, subsz] = await Promise.all([
    readEndpoint(baseUrl, 'connz', options.requestTimeoutMs, fetchJson, { limit: '1024' }),
    readEndpoint(baseUrl, 'subsz', options.requestTimeoutMs, fetchJson)
  ]);
  const report = reportFromEndpoints({
    baseUrl,
    connz,
    generatedAt,
    generatedInMs: generatedMilliseconds(startedAt),
    nowMs: options.nowMs ?? Date.now,
    state,
    subsz,
    varz
  });
  return report;
}

function reportFromEndpoints(input: {
  baseUrl: string;
  connz: EndpointResult;
  generatedAt: string;
  generatedInMs: number;
  nowMs: () => number;
  state: MonitorState;
  subsz: EndpointResult;
  varz: EndpointResult;
}): NatsTelemetryReport {
  const server = asRecord(input.varz.data);
  const connz = asRecord(input.connz.data);
  const subsz = asRecord(input.subsz.data);
  const traffic = trafficSample(server, input.nowMs);
  const rates = trafficRates(input.state.previousSample, traffic);
  input.state.previousSample = traffic;
  const pending = pendingConnections(connz);
  const optionalErrors = [input.connz.error, input.subsz.error].filter((error) => error !== null);

  return {
    connections: {
      active: numberValue(server.connections),
      leafnodes: numberValue(server.leafnodes),
      remotes: numberValue(server.remotes),
      routes: numberValue(server.routes),
      subscriptions: numberValue(server.subscriptions),
      total: numberValue(server.total_connections)
    },
    endpoints: {
      connzMs: input.connz.durationMs,
      subszMs: input.subsz.durationMs,
      varzMs: input.varz.durationMs
    },
    error: optionalErrors.length === 0 ? null : optionalErrors.join('; '),
    generatedAt: input.generatedAt,
    generatedInMs: input.generatedInMs,
    monitoringUrl: input.baseUrl,
    ok: optionalErrors.length === 0,
    pending,
    server: {
      cores: numberValue(server.cores),
      cpu: roundNumber(numberValue(server.cpu)),
      id: stringValue(server.server_id),
      gomaxprocs: numberValue(server.gomaxprocs),
      memoryBytes: numberValue(server.mem),
      name: stringValue(server.server_name),
      slowConsumers: numberValue(server.slow_consumers),
      uptime: stringValue(server.uptime),
      version: stringValue(server.version)
    },
    subscriptions: {
      avgFanout: nullableNumber(subsz.avg_fanout),
      cacheHitRate: nullableNumber(subsz.cache_hit_rate),
      cacheSize: nullableNumber(subsz.num_cache),
      count: numberValue(subsz.num_subscriptions, numberValue(server.subscriptions)),
      maxFanout: nullableNumber(subsz.max_fanout)
    },
    traffic: {
      inBytes: traffic.inBytes,
      inBytesPerSec: rates.inBytesPerSec,
      inMsgs: traffic.inMsgs,
      inMsgsPerSec: rates.inMsgsPerSec,
      outBytes: traffic.outBytes,
      outBytesPerSec: rates.outBytesPerSec,
      outMsgs: traffic.outMsgs,
      outMsgsPerSec: rates.outMsgsPerSec
    }
  };
}

function unavailableReport(input: {
  baseUrl: string;
  endpoints: NatsTelemetryReport['endpoints'];
  error: string;
  generatedAt: string;
  generatedInMs: number;
}): NatsTelemetryReport {
  return {
    connections: {
      active: 0,
      leafnodes: 0,
      remotes: 0,
      routes: 0,
      subscriptions: 0,
      total: 0
    },
    endpoints: input.endpoints,
    error: input.error,
    generatedAt: input.generatedAt,
    generatedInMs: input.generatedInMs,
    monitoringUrl: input.baseUrl,
    ok: false,
    pending: {
      connectionCount: 0,
      maxBytes: 0,
      top: [],
      totalBytes: 0
    },
    server: {
      cores: 0,
      cpu: 0,
      id: null,
      gomaxprocs: 0,
      memoryBytes: 0,
      name: null,
      slowConsumers: 0,
      uptime: null,
      version: null
    },
    subscriptions: {
      avgFanout: null,
      cacheHitRate: null,
      cacheSize: null,
      count: 0,
      maxFanout: null
    },
    traffic: {
      inBytes: 0,
      inBytesPerSec: null,
      inMsgs: 0,
      inMsgsPerSec: null,
      outBytes: 0,
      outBytesPerSec: null,
      outMsgs: 0,
      outMsgsPerSec: null
    }
  };
}

async function readEndpoint(
  baseUrl: string,
  endpoint: EndpointName,
  timeoutMs: number,
  fetchJson: FetchJson,
  params: Record<string, string> = {}
): Promise<EndpointResult> {
  const startedAt = performance.now();
  try {
    const url = endpointUrl(baseUrl, endpoint, params);
    const data = await fetchJson(url, timeoutMs);
    return {
      data: asRecord(data),
      durationMs: generatedMilliseconds(startedAt),
      error: null
    };
  } catch (error) {
    return {
      data: null,
      durationMs: generatedMilliseconds(startedAt),
      error: `${endpoint}: ${errorMessage(error)}`
    };
  }
}

async function fetchEndpointJson(url: URL, timeoutMs: number): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    throw new Error(`HTTP ${String(response.status)}`);
  }
  return response.json();
}

function endpointUrl(baseUrl: string, endpoint: EndpointName, params: Record<string, string>): URL {
  const url = new URL(endpoint, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function normalizedMonitoringUrl(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function trafficSample(server: Record<string, unknown>, nowMs: () => number): TrafficSample {
  return {
    atMs: nowMs(),
    inBytes: numberValue(server.in_bytes),
    inMsgs: numberValue(server.in_msgs),
    outBytes: numberValue(server.out_bytes),
    outMsgs: numberValue(server.out_msgs)
  };
}

function trafficRates(
  previous: TrafficSample | null,
  current: TrafficSample
): Pick<
  NatsTelemetryReport['traffic'],
  'inBytesPerSec' | 'inMsgsPerSec' | 'outBytesPerSec' | 'outMsgsPerSec'
> {
  if (previous === null) {
    return {
      inBytesPerSec: null,
      inMsgsPerSec: null,
      outBytesPerSec: null,
      outMsgsPerSec: null
    };
  }

  const elapsedSeconds = (current.atMs - previous.atMs) / 1000;
  return {
    inBytesPerSec: counterRate(previous.inBytes, current.inBytes, elapsedSeconds),
    inMsgsPerSec: counterRate(previous.inMsgs, current.inMsgs, elapsedSeconds),
    outBytesPerSec: counterRate(previous.outBytes, current.outBytes, elapsedSeconds),
    outMsgsPerSec: counterRate(previous.outMsgs, current.outMsgs, elapsedSeconds)
  };
}

function counterRate(previous: number, current: number, elapsedSeconds: number): number | null {
  if (elapsedSeconds <= 0 || current < previous) {
    return null;
  }
  return roundNumber((current - previous) / elapsedSeconds);
}

function pendingConnections(connz: Record<string, unknown>): NatsTelemetryReport['pending'] {
  const connections = Array.isArray(connz.connections) ? connz.connections : [];
  const rows = connections.map(pendingConnection).filter((row) => row.pendingBytes > 0);
  const sorted = rows.toSorted((left, right) => right.pendingBytes - left.pendingBytes);
  return {
    connectionCount: sorted.length,
    maxBytes: sorted[0]?.pendingBytes ?? 0,
    top: sorted.slice(0, PENDING_CONNECTION_LIMIT),
    totalBytes: sorted.reduce((sum, row) => sum + row.pendingBytes, 0)
  };
}

function pendingConnection(value: unknown): NatsTelemetryPendingConnection {
  const connection = asRecord(value);
  return {
    cid: numberValue(connection.cid),
    ip: stringValue(connection.ip),
    name: stringValue(connection.name),
    pendingBytes: numberValue(connection.pending_bytes),
    port: nullableNumber(connection.port),
    subscriptions: numberValue(connection.subscriptions)
  };
}

function generatedMilliseconds(startedAt: number): number {
  return roundNumber(performance.now() - startedAt);
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function numberValue(value: unknown, defaultValue = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : defaultValue;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
