import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  context,
  propagation,
  trace,
  TraceFlags,
  type TextMapGetter,
  type TextMapPropagator,
  type TextMapSetter
} from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  ATTR_RPC_METHOD,
  ATTR_RPC_SERVICE,
  METRIC_RPC_CLIENT_CALL_DURATION,
  METRIC_RPC_SERVER_CALL_DURATION
} from '@opentelemetry/semantic-conventions/incubating';
import type { TelemetrySpanInput } from '../src/telemetry/recorder.js';

const mocks = vi.hoisted(() => ({
  telemetrySpans: [] as TelemetrySpanInput[]
}));

const telemetry = vi.hoisted(() => ({
  timeTelemetrySpan: vi.fn((input: TelemetrySpanInput, operation: () => Promise<unknown>) => {
    mocks.telemetrySpans.push(input);
    return operation();
  })
}));

vi.mock('../src/telemetry/index.js', async (importOriginal) => {
  const module = await importOriginal<typeof import('../src/telemetry/index.js')>();
  return {
    ...module,
    timeTelemetrySpan: telemetry.timeTelemetrySpan
  };
});

import {
  callProcedure,
  ProcedureTransportError,
  startProcedureServer
} from '../src/rpc/httpRpc.js';

describe('http RPC transport', () => {
  beforeEach(() => {
    mocks.telemetrySpans.length = 0;
    telemetry.timeTelemetrySpan.mockClear();
  });

  afterEach(() => {
    context.disable();
    propagation.disable();
    trace.disable();
    mocks.telemetrySpans.length = 0;
    telemetry.timeTelemetrySpan.mockClear();
  });

  it('rejects oversized procedure request bodies before procedure dispatch', async () => {
    const server = await startProcedureServer(
      {
        failIfCalled() {
          throw new Error('procedure should not be called');
        }
      },
      { port: 0, service: 'sample' }
    );

    try {
      const response = await fetch(`${server.url}/rpc`, {
        body: 'x'.repeat(1_000_001),
        headers: {
          'content-type': 'application/json'
        },
        method: 'POST'
      });

      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: 'payload_too_large',
          message: 'Procedure request body exceeds 1000000 bytes'
        },
        ok: false
      });
    } finally {
      await server.stop();
    }
  });

  it('propagates trace context from client to server procedures', async () => {
    const provider = new NodeTracerProvider();
    provider.register({
      propagator: testTraceContextPropagator
    });
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const spanId = '00f067aa0ba902b7';
    const activeContext = trace.setSpan(
      context.active(),
      trace.wrapSpanContext({
        isRemote: false,
        spanId,
        traceFlags: TraceFlags.SAMPLED,
        traceId
      })
    );
    const server = await startProcedureServer(
      {
        readTrace() {
          return trace.getSpanContext(context.active())?.traceId ?? null;
        }
      },
      { port: 0, service: 'sample' }
    );

    try {
      const result = await context.with(activeContext, () =>
        callProcedure<string | null>(server.url, 'readTrace', undefined, { service: 'sample' })
      );

      expect(result).toBe(traceId);
    } finally {
      await server.stop();
      await provider.shutdown();
    }
  });

  it('wraps transport failures in a typed procedure transport error', async () => {
    const server = await startProcedureServer({}, { port: 0, service: 'sample' });
    const url = server.url;
    await server.stop();

    await expect(
      callProcedure(url, 'missing', undefined, { service: 'sample' })
    ).rejects.toBeInstanceOf(ProcedureTransportError);
  });

  it('records the configured RPC service on client and server telemetry', async () => {
    const server = await startProcedureServer(
      {
        echo(input) {
          return input;
        }
      },
      { port: 0, service: 'profile' }
    );

    try {
      await expect(
        callProcedure(server.url, 'echo', { text: 'hello' }, { service: 'profile' })
      ).resolves.toEqual({ text: 'hello' });

      expect(mocks.telemetrySpans).toHaveLength(2);
      const [clientSpan, serverSpan] = mocks.telemetrySpans;
      expect(clientSpan?.attributes?.[ATTR_RPC_METHOD]).toBe('echo');
      expect(clientSpan?.attributes?.[ATTR_RPC_SERVICE]).toBe('profile');
      expect(clientSpan?.metric?.name).toBe(METRIC_RPC_CLIENT_CALL_DURATION);
      expect(clientSpan?.metric?.attributes?.[ATTR_RPC_METHOD]).toBe('echo');
      expect(clientSpan?.metric?.attributes?.[ATTR_RPC_SERVICE]).toBe('profile');
      expect(serverSpan?.attributes?.[ATTR_RPC_METHOD]).toBe('echo');
      expect(serverSpan?.attributes?.[ATTR_RPC_SERVICE]).toBe('profile');
      expect(serverSpan?.metric?.name).toBe(METRIC_RPC_SERVER_CALL_DURATION);
      expect(serverSpan?.metric?.attributes?.[ATTR_RPC_METHOD]).toBe('echo');
      expect(serverSpan?.metric?.attributes?.[ATTR_RPC_SERVICE]).toBe('profile');
    } finally {
      await server.stop();
    }
  });
});

const testTraceContextPropagator: TextMapPropagator = {
  extract(activeContext, carrier, getter: TextMapGetter<unknown>) {
    const traceparent = stringValue(getter.get(carrier, 'traceparent'));
    if (traceparent === null) {
      return activeContext;
    }
    const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec(traceparent);
    if (match === null) {
      return activeContext;
    }
    const [, traceId, spanId, traceFlags] = match;
    if (traceId === undefined || spanId === undefined || traceFlags === undefined) {
      return activeContext;
    }
    return trace.setSpan(
      activeContext,
      trace.wrapSpanContext({
        isRemote: true,
        spanId,
        traceFlags: Number.parseInt(traceFlags, 16),
        traceId
      })
    );
  },
  fields() {
    return ['traceparent'];
  },
  inject(activeContext, carrier, setter: TextMapSetter<unknown>) {
    const spanContext = trace.getSpanContext(activeContext);
    if (spanContext === undefined) {
      return;
    }
    setter.set(
      carrier,
      'traceparent',
      `00-${spanContext.traceId}-${spanContext.spanId}-${spanContext.traceFlags.toString(16).padStart(2, '0')}`
    );
  }
};

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const first: unknown = value[0];
  return typeof first === 'string' ? first : null;
}
