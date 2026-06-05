import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { drainTelemetryBatch } from '../src/telemetry/recorder.js';

const mocks = vi.hoisted(() => ({
  poolInstances: [] as {
    end: () => Promise<void>;
    query: (first: unknown, ...rest: unknown[]) => unknown;
  }[]
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({}))
}));

vi.mock('drizzle-orm/node-postgres/migrator', () => ({
  migrate: vi.fn()
}));

vi.mock('pg', () => {
  class Pool {
    constructor() {
      mocks.poolInstances.push(this);
    }

    query(): Promise<{ rows: unknown[] }> {
      return Promise.resolve({ rows: [] });
    }

    end(): Promise<void> {
      return Promise.resolve();
    }
  }

  return { Pool };
});

describe('postgres telemetry', () => {
  const previousTelemetry = process.env.AGENTG_TELEMETRY;
  const previousTelemetrySource = process.env.AGENTG_TELEMETRY_SOURCE;

  beforeEach(() => {
    process.env.AGENTG_TELEMETRY = '1';
    process.env.AGENTG_TELEMETRY_SOURCE = 'framework-test';
    mocks.poolInstances.length = 0;
    drainTelemetryBatch(1000);
  });

  afterEach(() => {
    drainTelemetryBatch(1000);
    if (previousTelemetry === undefined) {
      delete process.env.AGENTG_TELEMETRY;
    } else {
      process.env.AGENTG_TELEMETRY = previousTelemetry;
    }
    if (previousTelemetrySource === undefined) {
      delete process.env.AGENTG_TELEMETRY_SOURCE;
    } else {
      process.env.AGENTG_TELEMETRY_SOURCE = previousTelemetrySource;
    }
  });

  it('does not record SQL text in query telemetry detail', async () => {
    const { postgres } = await import('../src/database/postgres.js');
    postgres({ schema: {}, url: 'postgres://framework-test' });

    const pool = mocks.poolInstances[0];
    expect(pool).toBeDefined();
    await pool?.query({
      text: "select * from users where token = 'super-secret-token' and email = $1"
    });

    const batch = drainTelemetryBatch(10);

    expect(batch?.records).toHaveLength(1);
    expect(batch?.records[0]).toMatchObject({
      detail: {
        classification: 'read',
        operation: 'select',
        relations: ['users']
      },
      kind: 'postgres.query',
      name: 'select users',
      ok: true,
      source: 'framework-test'
    });
    expect(batch?.records[0]?.detail).not.toHaveProperty('sql');
    expect(JSON.stringify(batch)).not.toContain('super-secret-token');
  });
});
