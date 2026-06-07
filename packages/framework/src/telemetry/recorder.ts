import { performance } from 'node:perf_hooks';

import {
  metrics,
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
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  AggregationType,
  InstrumentType,
  MeterProvider,
  PeriodicExportingMetricReader
} from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

import type { TelemetryAttributes, TelemetryAttributeValue } from './contracts.js';

type TelemetryRuntime = {
  meterProvider: MeterProvider;
  source: string;
  tracerProvider: NodeTracerProvider;
};

export type TelemetrySpanInput = {
  attributes?: TelemetryAttributes | undefined;
  detail?: Record<string, unknown> | undefined;
  kind: string;
  name: string;
  source?: string | undefined;
};

export type TelemetrySpan = {
  finish(result: {
    attributes?: TelemetryAttributes | undefined;
    detail?: Record<string, unknown> | undefined;
    error?: unknown;
    ok: boolean;
  }): void;
};

const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);
const DEFAULT_METRIC_EXPORT_INTERVAL_MS = 15_000;
const DEFAULT_SERVICE_NAME = 'agentg';
const DEFAULT_TRACES_ENDPOINT = 'http://127.0.0.1:4318/v1/traces';
const DEFAULT_METRICS_ENDPOINT = 'http://127.0.0.1:8428/opentelemetry/v1/metrics';
const OPERATION_DURATION_BUCKETS_SECONDS = [
  0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5
];

const counters = new Map<string, Counter>();
const gauges = new Map<string, ObservableGauge>();
const gaugeValues = new Map<string, Map<string, GaugeValue>>();
const histograms = new Map<string, Histogram>();
let runtime: TelemetryRuntime | null = null;
let operationDuration: Histogram | null = null;
let operationCalls: Counter | null = null;
let operationErrors: Counter | null = null;

type GaugeValue = {
  attributes: TelemetryAttributes;
  value: number;
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
    [ATTR_SERVICE_NAME]: configuredName
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
    views: [
      {
        aggregation: {
          options: {
            boundaries: OPERATION_DURATION_BUCKETS_SECONDS
          },
          type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM
        },
        instrumentName: 'agentg.operation.duration',
        instrumentType: InstrumentType.HISTOGRAM
      }
    ]
  });

  tracerProvider.register();
  metrics.setGlobalMeterProvider(meterProvider);
  resetMetricInstruments();
  runtime = {
    meterProvider,
    source: configuredName,
    tracerProvider
  };

  return async () => {
    const activeRuntime = runtime;
    runtime = null;
    if (activeRuntime === null) {
      return undefined;
    }
    await activeRuntime.meterProvider.shutdown();
    await activeRuntime.tracerProvider.shutdown();
    return undefined;
  };
}

export function startTelemetrySpan(input: TelemetrySpanInput): TelemetrySpan | null {
  if (!telemetryEnabled()) {
    return null;
  }

  const startedAt = performance.now();
  const attributes = operationAttributes(input, input.attributes ?? {});
  const span = activeTracer().startSpan(spanName(input), {
    attributes: spanAttributes(input, attributes)
  });
  let finished = false;

  return {
    finish(result): void {
      if (finished) {
        return;
      }
      finished = true;
      const durationSeconds = secondsSince(startedAt);
      const resultAttributes = operationAttributes(input, {
        ...(input.attributes ?? {}),
        ...(result.attributes ?? {})
      });
      if (result.detail !== undefined) {
        span.setAttributes(detailAttributes(result.detail));
      }
      if (result.error !== undefined) {
        span.recordException(errorObject(result.error));
      }
      span.setStatus(
        result.ok
          ? { code: SpanStatusCode.OK }
          : { code: SpanStatusCode.ERROR, message: errorMessage(result.error) }
      );
      span.end();
      recordOperationMetrics(durationSeconds, result.ok, resultAttributes);
    }
  };
}

export async function timeTelemetryOperation<T>(
  input: TelemetrySpanInput,
  operation: () => Promise<T>
): Promise<T> {
  if (!telemetryEnabled()) {
    return operation();
  }

  const startedAt = performance.now();
  const attributes = operationAttributes(input, input.attributes ?? {});
  return activeTracer().startActiveSpan(
    spanName(input),
    { attributes: spanAttributes(input, attributes) },
    async (span) => {
      try {
        const result = await operation();
        finishSpan(span, startedAt, true, attributes);
        return result;
      } catch (error) {
        finishSpan(span, startedAt, false, attributes, error);
        throw error;
      }
    }
  );
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
  attributes: TelemetryAttributes = {}
): void {
  if (!telemetryEnabled() || !Number.isFinite(value) || value < 0) {
    return;
  }
  let histogram = histograms.get(name);
  if (histogram === undefined) {
    histogram = activeMeter().createHistogram(name);
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
  operationCalls = null;
  operationDuration = null;
  operationErrors = null;
}

function recordOperationMetrics(
  durationSeconds: number,
  ok: boolean,
  attributes: TelemetryAttributes
): void {
  const duration = operationDurationInstrument();
  const calls = operationCallsInstrument();
  const errors = operationErrorsInstrument();
  duration.record(durationSeconds, attributes);
  calls.add(1, {
    ...attributes,
    status: ok ? 'ok' : 'error'
  });
  if (!ok) {
    errors.add(1, attributes);
  }
}

function finishSpan(
  span: Span,
  startedAt: number,
  ok: boolean,
  attributes: TelemetryAttributes,
  error?: unknown
): void {
  const durationSeconds = secondsSince(startedAt);
  if (error !== undefined) {
    span.recordException(errorObject(error));
  }
  span.setStatus(
    ok ? { code: SpanStatusCode.OK } : { code: SpanStatusCode.ERROR, message: errorMessage(error) }
  );
  span.end();
  recordOperationMetrics(durationSeconds, ok, attributes);
}

function activeMeter(): Meter {
  return metrics.getMeter('agentg.telemetry');
}

function activeTracer(): Tracer {
  return trace.getTracer('agentg.telemetry');
}

function operationDurationInstrument(): Histogram {
  operationDuration ??= activeMeter().createHistogram('agentg.operation.duration', {
    description: 'AgentG operation duration',
    unit: 's'
  });
  return operationDuration;
}

function operationCallsInstrument(): Counter {
  operationCalls ??= activeMeter().createCounter('agentg.operation.calls', {
    description: 'AgentG operation calls',
    unit: '1'
  });
  return operationCalls;
}

function operationErrorsInstrument(): Counter {
  operationErrors ??= activeMeter().createCounter('agentg.operation.errors', {
    description: 'AgentG operation errors',
    unit: '1'
  });
  return operationErrors;
}

function operationAttributes(
  input: TelemetrySpanInput,
  extraAttributes: TelemetryAttributes
): TelemetryAttributes {
  return {
    operation_kind: input.kind,
    operation_name: input.name,
    source: input.source ?? telemetrySource(),
    ...extraAttributes
  };
}

function spanAttributes(input: TelemetrySpanInput, attributes: TelemetryAttributes): Attributes {
  return {
    ...attributes,
    ...(input.detail === undefined ? {} : detailAttributes(input.detail))
  };
}

function detailAttributes(detail: Record<string, unknown>): Attributes {
  const attributes: Attributes = {};
  for (const [key, value] of Object.entries(detail)) {
    const attribute = attributeValue(value);
    if (attribute !== null) {
      attributes[`agentg.detail.${key}`] = attribute;
    }
  }
  return attributes;
}

function attributeValue(value: unknown): TelemetryAttributeValue | string[] | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const values = value.filter((item): item is string => typeof item === 'string');
  return values.length === value.length ? values : null;
}

function spanName(input: TelemetrySpanInput): string {
  return `${input.kind}:${input.name}`;
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

function telemetrySource(): string {
  return runtime?.source ?? configuredServiceName(DEFAULT_SERVICE_NAME);
}

function configuredServiceName(fallback: string): string {
  const configured = process.env.OTEL_SERVICE_NAME?.trim();
  return configured === undefined || configured.length === 0 ? fallback : configured;
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
