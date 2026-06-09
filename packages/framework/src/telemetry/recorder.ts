import { hostname } from 'node:os';
import { performance } from 'node:perf_hooks';

import {
  context,
  metrics,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Counter,
  type Histogram,
  type Meter,
  type ObservableGauge,
  type Span,
  type Tracer
} from '@opentelemetry/api';
import { SeverityNumber, type LogAttributes, type LogBody } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import {
  AggregationType,
  InstrumentType,
  MeterProvider,
  PeriodicExportingMetricReader,
  type ViewOptions
} from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_ERROR_TYPE, ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { ATTR_HOST_NAME } from '@opentelemetry/semantic-conventions/incubating';

import { configuredServiceName } from '../runtimeIdentity.js';
import type { TelemetryAttributes } from './contracts.js';

type TelemetryRuntime = {
  loggerProvider: LoggerProvider;
  meterProvider: MeterProvider;
  tracerProvider: NodeTracerProvider;
};

export type TelemetryDurationMetric = {
  attributes?: TelemetryAttributes | undefined;
  description?: string | undefined;
  name: string;
  unit?: string | undefined;
};

export type TelemetrySpanInput = {
  attributes?: TelemetryAttributes | undefined;
  kind?: SpanKind | undefined;
  metric?: TelemetryDurationMetric | undefined;
  name: string;
};

export type TelemetrySpan = {
  finish(result: {
    attributes?: TelemetryAttributes | undefined;
    error?: unknown;
    ok: boolean;
  }): void;
};

const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);
const DEFAULT_LOGS_ENDPOINT = 'http://127.0.0.1:4318/v1/logs';
const DEFAULT_METRIC_EXPORT_INTERVAL_MS = 15_000;
const DEFAULT_TRACES_ENDPOINT = 'http://127.0.0.1:4318/v1/traces';
const DEFAULT_METRICS_ENDPOINT = 'http://127.0.0.1:4318/v1/metrics';
const DURATION_BUCKETS_SECONDS = [
  0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5
];

const counters = new Map<string, Counter>();
const gauges = new Map<string, ObservableGauge>();
const gaugeValues = new Map<string, Map<string, GaugeValue>>();
const histograms = new Map<string, Histogram>();
let runtime: TelemetryRuntime | null = null;

type GaugeValue = {
  attributes: TelemetryAttributes;
  value: number;
};

export type TelemetryLogRecord = {
  attributes?: LogAttributes | undefined;
  body: LogBody;
  severityNumber: SeverityNumber;
  severityText: string;
};

export function telemetryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.AGENTG_TELEMETRY?.trim().toLowerCase();
  return value !== undefined && value.length > 0 && !DISABLED_VALUES.has(value);
}

export function startTelemetryRuntime(serviceName: string): () => Promise<undefined> {
  if (!telemetryEnabled()) {
    return () => Promise.resolve(undefined);
  }
  if (runtime !== null) {
    return () => Promise.resolve(undefined);
  }

  const configuredName = configuredServiceName(serviceName);
  const resource = resourceFromAttributes({
    [ATTR_HOST_NAME]: hostname(),
    [ATTR_SERVICE_NAME]: configuredName
  });
  const loggerProvider = new LoggerProvider({
    processors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({
          url: telemetryEndpoint('OTEL_EXPORTER_OTLP_LOGS_ENDPOINT', DEFAULT_LOGS_ENDPOINT)
        })
      )
    ],
    resource
  });
  const tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: telemetryEndpoint('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', DEFAULT_TRACES_ENDPOINT)
        })
      )
    ]
  });
  const meterProvider = new MeterProvider({
    readers: [
      new PeriodicExportingMetricReader({
        exportIntervalMillis: metricExportIntervalMs(),
        exporter: new OTLPMetricExporter({
          url: telemetryEndpoint('OTEL_EXPORTER_OTLP_METRICS_ENDPOINT', DEFAULT_METRICS_ENDPOINT)
        })
      })
    ],
    resource,
    views: [durationView('*')]
  });

  tracerProvider.register();
  metrics.setGlobalMeterProvider(meterProvider);
  resetMetricInstruments();
  runtime = {
    loggerProvider,
    meterProvider,
    tracerProvider
  };

  return async () => {
    const activeRuntime = runtime;
    runtime = null;
    if (activeRuntime === null) {
      return undefined;
    }
    await activeRuntime.loggerProvider.shutdown();
    await activeRuntime.meterProvider.shutdown();
    await activeRuntime.tracerProvider.shutdown();
    return undefined;
  };
}

export function recordTelemetryLog(record: TelemetryLogRecord): void {
  if (!telemetryEnabled() || runtime === null) {
    return;
  }
  runtime.loggerProvider.getLogger('agentg.log').emit({
    ...(record.attributes === undefined ? {} : { attributes: record.attributes }),
    body: record.body,
    context: context.active(),
    severityNumber: record.severityNumber,
    severityText: record.severityText
  });
}

export function startTelemetrySpan(input: TelemetrySpanInput): TelemetrySpan | null {
  if (!telemetryEnabled()) {
    return null;
  }

  const startedAt = performance.now();
  const span = activeTracer().startSpan(spanName(input), spanOptions(input));
  let finished = false;

  return {
    finish(result): void {
      if (finished) {
        return;
      }
      finished = true;
      const durationSeconds = secondsSince(startedAt);
      const resultAttributes = spanResultAttributes(result);
      span.setAttributes(resultAttributes);
      if (result.error !== undefined) {
        span.recordException(errorObject(result.error));
      }
      span.setStatus(
        result.ok
          ? { code: SpanStatusCode.OK }
          : { code: SpanStatusCode.ERROR, message: errorMessage(result.error) }
      );
      span.end();
      recordDurationMetric(input.metric, durationSeconds, result);
    }
  };
}

export async function timeTelemetrySpan<T>(
  input: TelemetrySpanInput,
  operation: () => Promise<T>
): Promise<T> {
  if (!telemetryEnabled()) {
    return operation();
  }

  const startedAt = performance.now();
  const result = await activeTracer().startActiveSpan(
    spanName(input),
    spanOptions(input),
    async (span): Promise<T> => {
      try {
        const value = await operation();
        finishSpan(input.metric, span, startedAt, true);
        return value;
      } catch (error) {
        finishSpan(input.metric, span, startedAt, false, error);
        throw error;
      }
    }
  );
  return result;
}

export function incrementTelemetryCounter(
  name: string,
  value: number,
  attributes: TelemetryAttributes = {}
): void {
  if (!telemetryEnabled() || !Number.isFinite(value) || value <= 0) {
    return;
  }
  let counter = counters.get(name);
  if (counter === undefined) {
    counter = activeMeter().createCounter(name, { unit: '1' });
    counters.set(name, counter);
  }
  counter.add(value, attributes);
}

export function recordTelemetryHistogram(
  name: string,
  value: number,
  attributes: TelemetryAttributes = {},
  options: { description?: string | undefined; unit?: string | undefined } = {}
): void {
  if (!telemetryEnabled() || !Number.isFinite(value) || value < 0) {
    return;
  }
  let histogram = histograms.get(name);
  if (histogram === undefined) {
    histogram = activeMeter().createHistogram(name, {
      ...(options.description === undefined ? {} : { description: options.description }),
      ...(options.unit === undefined ? {} : { unit: options.unit })
    });
    histograms.set(name, histogram);
  }
  histogram.record(value, attributes);
}

export function setTelemetryGauge(
  name: string,
  value: number,
  attributes: TelemetryAttributes = {}
): void {
  if (!telemetryEnabled() || !Number.isFinite(value)) {
    return;
  }
  let gauge = gauges.get(name);
  if (gauge === undefined) {
    gauge = activeMeter().createObservableGauge(name);
    gauge.addCallback((result) => {
      for (const current of gaugeValues.get(name)?.values() ?? []) {
        result.observe(current.value, current.attributes);
      }
    });
    gauges.set(name, gauge);
  }
  let values = gaugeValues.get(name);
  if (values === undefined) {
    values = new Map();
    gaugeValues.set(name, values);
  }
  values.set(attributesKey(attributes), {
    attributes,
    value
  });
}

function resetMetricInstruments(): void {
  counters.clear();
  gauges.clear();
  histograms.clear();
}

function finishSpan(
  metric: TelemetryDurationMetric | undefined,
  span: Span,
  startedAt: number,
  ok: boolean,
  error?: unknown
): void {
  const durationSeconds = secondsSince(startedAt);
  const result = { error, ok };
  if (error !== undefined) {
    span.recordException(errorObject(error));
  }
  span.setAttributes(spanResultAttributes(result));
  span.setStatus(
    ok ? { code: SpanStatusCode.OK } : { code: SpanStatusCode.ERROR, message: errorMessage(error) }
  );
  span.end();
  recordDurationMetric(metric, durationSeconds, result);
}

function activeMeter(): Meter {
  return metrics.getMeter('agentg.telemetry');
}

function activeTracer(): Tracer {
  return trace.getTracer('agentg.telemetry');
}

function durationView(instrumentName: string): ViewOptions {
  return {
    aggregation: {
      options: {
        boundaries: DURATION_BUCKETS_SECONDS
      },
      type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM
    },
    instrumentName,
    instrumentType: InstrumentType.HISTOGRAM
  };
}

function spanOptions(input: TelemetrySpanInput) {
  return {
    ...(input.attributes === undefined ? {} : { attributes: input.attributes }),
    ...(input.kind === undefined ? {} : { kind: input.kind })
  };
}

function recordDurationMetric(
  metric: TelemetryDurationMetric | undefined,
  durationSeconds: number,
  result: { error?: unknown; ok: boolean }
): void {
  if (metric === undefined) {
    return;
  }
  const attributes = {
    ...(metric.attributes ?? {}),
    ...resultMetricAttributes(result)
  };
  durationMetricInstrument(metric).record(durationSeconds, attributes);
}

function durationMetricInstrument(metric: TelemetryDurationMetric): Histogram {
  let histogram = histograms.get(metric.name);
  if (histogram === undefined) {
    histogram = activeMeter().createHistogram(metric.name, {
      ...(metric.description === undefined ? {} : { description: metric.description }),
      unit: metric.unit ?? 's'
    });
    histograms.set(metric.name, histogram);
  }
  return histogram;
}

function spanResultAttributes(result: {
  attributes?: TelemetryAttributes | undefined;
  error?: unknown;
}): Attributes {
  return {
    ...(result.attributes ?? {}),
    ...(result.error === undefined ? {} : { [ATTR_ERROR_TYPE]: errorType(result.error) })
  };
}

function resultMetricAttributes(result: { error?: unknown; ok: boolean }): TelemetryAttributes {
  if (result.ok) {
    return {};
  }
  return {
    [ATTR_ERROR_TYPE]: errorType(result.error)
  };
}

function spanName(input: TelemetrySpanInput): string {
  return input.name;
}

function secondsSince(startedAtMs: number): number {
  return Math.max(0, performance.now() - startedAtMs) / 1000;
}

function attributesKey(attributes: TelemetryAttributes): string {
  return JSON.stringify(
    Object.entries(attributes)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, String(value)])
  );
}

function metricExportIntervalMs(): number {
  const configured = Number(process.env.OTEL_METRIC_EXPORT_INTERVAL);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_METRIC_EXPORT_INTERVAL_MS;
  }
  return Math.round(configured);
}

function telemetryEndpoint(envName: string, fallback: string): string {
  const configured = process.env[envName]?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured;
  }
  const sharedEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (sharedEndpoint !== undefined && sharedEndpoint.length > 0) {
    return sharedEndpoint;
  }
  return fallback;
}

function errorObject(error: unknown): Error {
  return error instanceof Error ? error : new Error(errorMessage(error));
}

function errorType(error: unknown): string {
  if (error instanceof Error && error.name.length > 0) {
    return error.name;
  }
  return typeof error;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === 'string' ||
    typeof error === 'number' ||
    typeof error === 'boolean' ||
    typeof error === 'bigint'
  ) {
    return String(error);
  }
  if (typeof error === 'symbol') {
    return error.description ?? 'unknown error';
  }
  if (error === null || error === undefined) {
    return 'unknown error';
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'unknown error';
  }
}
