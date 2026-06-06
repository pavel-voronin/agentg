import { describe, expect, it } from 'vitest';

import {
  natsPageView,
  type NatsReport
} from '../control-plane/frontend/telemetry/nats/natsView.js';

describe('NATS telemetry view', () => {
  it('formats NATS server load and pending connections', () => {
    const view = natsPageView(report());

    expect(view.status).toEqual({
      label: 'Monitoring',
      tone: 'ok'
    });
    expect(view.summaryCards).toContainEqual(
      expect.objectContaining({
        detail: 'local 2.12.0',
        label: 'Server',
        tone: 'neutral',
        value: '1h'
      })
    );
    expect(view.summaryCards).toContainEqual(
      expect.objectContaining({
        detail: 'pending 4 KB across 1 connections',
        label: 'Slow consumers',
        tone: 'bad',
        value: '1'
      })
    );
    expect(view.trafficRows).toContainEqual(
      expect.objectContaining({
        detail: '1,000 total',
        key: 'in-msgs',
        label: 'Inbound messages',
        tone: 'neutral',
        value: '20/s'
      })
    );
    expect(view.trafficRows).toContainEqual(
      expect.objectContaining({
        key: 'pending',
        tone: 'warn',
        value: '4 KB'
      })
    );
    expect(view.endpointRows).toContainEqual(
      expect.objectContaining({
        key: 'varz',
        tone: 'ok',
        value: '1.0ms'
      })
    );
    expect(view.pendingRows).toEqual([
      {
        address: '127.0.0.1:4222',
        key: '2',
        name: 'telegram',
        pending: '4 KB',
        pendingTone: 'warn',
        pendingTooltip:
          'Pending bytes mean at least one connection has unread data buffered in NATS.',
        subscriptions: '5'
      }
    ]);
  });

  it('marks missing subscriptions and slow endpoints as unhealthy', () => {
    const unhealthy = report();
    unhealthy.connections.active = 0;
    unhealthy.subscriptions.count = 0;
    unhealthy.endpoints.varzMs = null;
    unhealthy.endpoints.connzMs = 750;
    unhealthy.endpoints.subszMs = 1200;
    unhealthy.pending.totalBytes = 0;
    unhealthy.pending.maxBytes = 0;
    unhealthy.pending.connectionCount = 0;
    unhealthy.pending.top = [];
    unhealthy.server.slowConsumers = 0;

    const view = natsPageView(unhealthy);

    expect(view.summaryCards).toContainEqual(
      expect.objectContaining({
        label: 'Connections',
        tone: 'bad',
        value: '0'
      })
    );
    expect(view.summaryCards).toContainEqual(
      expect.objectContaining({
        label: 'Subscriptions',
        tone: 'bad',
        value: '0'
      })
    );
    expect(view.summaryCards).toContainEqual(
      expect.objectContaining({
        label: 'Slow consumers',
        tone: 'ok',
        value: '0'
      })
    );
    expect(view.endpointRows).toContainEqual(
      expect.objectContaining({
        key: 'varz',
        tone: 'bad',
        value: '-'
      })
    );
    expect(view.endpointRows).toContainEqual(
      expect.objectContaining({
        key: 'connz',
        tone: 'warn',
        value: '750ms'
      })
    );
    expect(view.endpointRows).toContainEqual(
      expect.objectContaining({
        key: 'subsz',
        tone: 'bad',
        value: '1.20s'
      })
    );
  });
});

function report(): NatsReport {
  return {
    connections: {
      active: 3,
      leafnodes: 0,
      remotes: 0,
      routes: 0,
      subscriptions: 12,
      total: 9
    },
    endpoints: {
      connzMs: 2,
      subszMs: 3,
      varzMs: 1
    },
    error: null,
    generatedAt: '2026-06-04T00:00:00.000Z',
    generatedInMs: 6,
    monitoringUrl: 'http://127.0.0.1:8222/',
    ok: true,
    pending: {
      connectionCount: 1,
      maxBytes: 4096,
      top: [
        {
          cid: 2,
          ip: '127.0.0.1',
          name: 'telegram',
          pendingBytes: 4096,
          port: 4222,
          subscriptions: 5
        }
      ],
      totalBytes: 4096
    },
    server: {
      cores: 8,
      cpu: 2.5,
      id: 'server-a',
      gomaxprocs: 8,
      memoryBytes: 42_000_000,
      name: 'local',
      slowConsumers: 1,
      uptime: '1h',
      version: '2.12.0'
    },
    subscriptions: {
      avgFanout: 1.5,
      cacheHitRate: 75,
      cacheSize: 4,
      count: 12,
      maxFanout: 3
    },
    traffic: {
      inBytes: 1000,
      inBytesPerSec: 500,
      inMsgs: 1000,
      inMsgsPerSec: 20,
      outBytes: 800,
      outBytesPerSec: 400,
      outMsgs: 900,
      outMsgsPerSec: 18
    }
  };
}
