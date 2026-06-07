import { afterEach, describe, expect, it } from 'vitest';
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

import { callProcedure, startProcedureServer } from '../src/rpc/httpRpc.js';

describe('http RPC transport', () => {
  afterEach(() => {
    context.disable();
    propagation.disable();
    trace.disable();
  });

  it('rejects oversized procedure request bodies before procedure dispatch', async () => {
    const server = await startProcedureServer(
      {
        failIfCalled() {
          throw new Error('procedure should not be called');
        }
      },
      { port: 0 }
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
      { port: 0 }
    );

    try {
      const result = await context.with(activeContext, () =>
        callProcedure<string | null>(server.url, 'readTrace')
      );

      expect(result).toBe(traceId);
    } finally {
      await server.stop();
      await provider.shutdown();
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
