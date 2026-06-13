import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type LogProcessorConfig = {
  scheduledDelayMillis?: number;
};

type MetricReaderOptions = {
  exportIntervalMillis?: number;
};

const mocks = vi.hoisted(() => ({
  logProcessorConfigs: [] as LogProcessorConfig[],
  metricReaderOptions: [] as MetricReaderOptions[]
}));

vi.mock('@opentelemetry/api', () => ({
  context: {
    active() {
      return {};
    },
    with(_context: unknown, operation: () => unknown) {
      return operation();
    }
  },
  metrics: {
    getMeter() {
      return {
        createCounter() {
          return {
            add() {
              return undefined;
            }
          };
        },
        createHistogram() {
          return {
            record() {
              return undefined;
            }
          };
        },
        createObservableGauge() {
          return {
            addCallback() {
              return undefined;
            }
          };
        }
      };
    },
    setGlobalMeterProvider() {
      return undefined;
    }
  },
  SpanKind: {},
  SpanStatusCode: {
    ERROR: 2,
    OK: 1
  },
  trace: {
    getTracer() {
      return {
        startActiveSpan(_name: string, _options: unknown, operation: (span: unknown) => unknown) {
          return operation(mockSpan());
        },
        startSpan() {
          return mockSpan();
        }
      };
    }
  }
}));

vi.mock('@opentelemetry/exporter-logs-otlp-proto', () => ({
  OTLPLogExporter: class {
    readonly options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }
  }
}));

vi.mock('@opentelemetry/exporter-metrics-otlp-proto', () => ({
  OTLPMetricExporter: class {
    readonly options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }
  }
}));

vi.mock('@opentelemetry/exporter-trace-otlp-proto', () => ({
  OTLPTraceExporter: class {
    readonly options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }
  }
}));

vi.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes(attributes: Record<string, unknown>) {
    return attributes;
  }
}));

vi.mock('@opentelemetry/sdk-logs', () => ({
  BatchLogRecordProcessor: class {
    readonly config: LogProcessorConfig | undefined;
    readonly exporter: unknown;

    constructor(_exporter: unknown, config: LogProcessorConfig | undefined) {
      this.exporter = _exporter;
      this.config = config;
      mocks.logProcessorConfigs.push(config ?? {});
    }
  },
  LoggerProvider: class {
    readonly options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }

    getLogger() {
      return {
        emit() {
          return undefined;
        }
      };
    }

    shutdown() {
      return Promise.resolve();
    }
  }
}));

vi.mock('@opentelemetry/sdk-metrics', () => ({
  AggregationType: {
    EXPLICIT_BUCKET_HISTOGRAM: 'explicit_bucket_histogram'
  },
  InstrumentType: {
    HISTOGRAM: 'histogram'
  },
  MeterProvider: class {
    readonly options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }

    shutdown() {
      return Promise.resolve();
    }
  },
  PeriodicExportingMetricReader: class {
    readonly options: MetricReaderOptions;

    constructor(options: MetricReaderOptions) {
      this.options = options;
      mocks.metricReaderOptions.push(options);
    }
  }
}));

vi.mock('@opentelemetry/sdk-trace-base', () => ({
  BatchSpanProcessor: class {
    readonly exporter: unknown;

    constructor(exporter: unknown) {
      this.exporter = exporter;
    }
  }
}));

vi.mock('@opentelemetry/sdk-trace-node', () => ({
  NodeTracerProvider: class {
    readonly options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }

    register() {
      return undefined;
    }

    shutdown() {
      return Promise.resolve();
    }
  }
}));

describe('telemetry runtime export cadence', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, AGENTG_TELEMETRY: '1' };
    delete process.env.OTEL_BLRP_SCHEDULE_DELAY;
    delete process.env.OTEL_METRIC_EXPORT_INTERVAL;
    mocks.logProcessorConfigs.length = 0;
    mocks.metricReaderOptions.length = 0;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults metrics and logs to a one second export cadence', async () => {
    const { startTelemetryRuntime } = await import('../src/telemetry/recorder.js');

    const stop = startTelemetryRuntime('test');

    expect(mocks.metricReaderOptions).toHaveLength(1);
    expect(mocks.metricReaderOptions[0]?.exportIntervalMillis).toBe(1000);
    expect(mocks.logProcessorConfigs).toHaveLength(1);
    expect(mocks.logProcessorConfigs[0]?.scheduledDelayMillis).toBe(1000);

    await stop();
  });

  it('keeps explicit cadence environment overrides', async () => {
    process.env.OTEL_BLRP_SCHEDULE_DELAY = '1500';
    process.env.OTEL_METRIC_EXPORT_INTERVAL = '2500';
    const { startTelemetryRuntime } = await import('../src/telemetry/recorder.js');

    const stop = startTelemetryRuntime('test');

    expect(mocks.metricReaderOptions[0]?.exportIntervalMillis).toBe(2500);
    expect(mocks.logProcessorConfigs[0]?.scheduledDelayMillis).toBe(1500);

    await stop();
  });
});

function mockSpan() {
  return {
    end() {
      return undefined;
    },
    recordException() {
      return undefined;
    },
    setAttributes() {
      return undefined;
    },
    setStatus() {
      return undefined;
    }
  };
}
