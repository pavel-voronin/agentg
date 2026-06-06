import { describe, expect, it } from 'vitest';

import { createNatsMonitor } from '../src/natsMonitor.js';

describe('NATS monitor', () => {
  it('builds a transport report from NATS monitoring endpoints', async () => {
    let nowMs = 1000;
    let inMsgs = 100;
    let outMsgs = 80;
    let inBytes = 1000;
    let outBytes = 800;
    const monitor = createNatsMonitor({
      fetchJson: (url) => {
        if (url.pathname === '/varz') {
          return Promise.resolve({
            connections: 3,
            cores: 8,
            cpu: 2.5,
            gomaxprocs: 8,
            in_bytes: inBytes,
            in_msgs: inMsgs,
            leafnodes: 0,
            mem: 42_000_000,
            out_bytes: outBytes,
            out_msgs: outMsgs,
            remotes: 0,
            routes: 0,
            server_id: 'server-a',
            server_name: 'local',
            slow_consumers: 1,
            subscriptions: 12,
            total_connections: 9,
            uptime: '1h',
            version: '2.12.0'
          });
        }
        if (url.pathname === '/connz') {
          expect(url.searchParams.get('limit')).toBe('1024');
          return Promise.resolve({
            connections: [
              {
                cid: 1,
                ip: '127.0.0.1',
                name: 'gateway',
                pending_bytes: 0,
                port: 4222,
                subscriptions: 2
              },
              {
                cid: 2,
                ip: '127.0.0.1',
                name: 'telegram',
                pending_bytes: 4096,
                port: 4222,
                subscriptions: 5
              }
            ]
          });
        }
        if (url.pathname === '/subsz') {
          return Promise.resolve({
            avg_fanout: 1.5,
            cache_hit_rate: 75,
            max_fanout: 3,
            num_cache: 4,
            num_subscriptions: 12
          });
        }
        return Promise.reject(new Error(`Unexpected NATS endpoint: ${url.pathname}`));
      },
      monitoringUrl: 'http://127.0.0.1:8222',
      nowMs: () => nowMs,
      requestTimeoutMs: 1000
    });

    const first = await monitor.readReport();
    nowMs = 3000;
    inMsgs = 130;
    outMsgs = 100;
    inBytes = 2500;
    outBytes = 1800;
    const second = await monitor.readReport();

    expect(first).toMatchObject({
      connections: {
        active: 3,
        subscriptions: 12,
        total: 9
      },
      ok: true,
      pending: {
        connectionCount: 1,
        maxBytes: 4096,
        totalBytes: 4096
      },
      server: {
        cpu: 2.5,
        id: 'server-a',
        memoryBytes: 42_000_000,
        name: 'local',
        slowConsumers: 1
      },
      subscriptions: {
        cacheHitRate: 75,
        count: 12,
        maxFanout: 3
      },
      traffic: {
        inMsgs: 100,
        inMsgsPerSec: null
      }
    });
    expect(first.pending.top[0]).toMatchObject({
      cid: 2,
      name: 'telegram',
      pendingBytes: 4096,
      subscriptions: 5
    });
    expect(second.traffic).toMatchObject({
      inBytesPerSec: 750,
      inMsgsPerSec: 15,
      outBytesPerSec: 500,
      outMsgsPerSec: 10
    });
  });
});
