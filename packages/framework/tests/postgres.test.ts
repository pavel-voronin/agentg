import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  poolInstances: [] as {
    end: () => Promise<void>;
    query: (first: unknown, ...rest: unknown[]) => unknown;
  }[],
  telemetrySpans: [] as unknown[]
}));

const telemetry = vi.hoisted(() => ({
  startTelemetrySpan: vi.fn((input: unknown) => {
    mocks.telemetrySpans.push(input);
    return {
      finish: vi.fn()
    };
  })
}));

vi.mock('../src/telemetry/index.js', async (importOriginal) => {
  const module = await importOriginal<typeof import('../src/telemetry/index.js')>();
  return {
    ...module,
    startTelemetrySpan: telemetry.startTelemetrySpan
  };
});

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
  beforeEach(() => {
    mocks.poolInstances.length = 0;
    mocks.telemetrySpans.length = 0;
    telemetry.startTelemetrySpan.mockClear();
  });

  afterEach(() => {
    mocks.telemetrySpans.length = 0;
    telemetry.startTelemetrySpan.mockClear();
  });

  it('does not record SQL text in query telemetry detail', async () => {
    const { postgres } = await import('../src/database/postgres.js');
    postgres({ schema: {}, url: 'postgres://framework-test' });

    const pool = mocks.poolInstances[0];
    expect(pool).toBeDefined();
    await pool?.query({
      text: "select * from users where token = 'super-secret-token' and email = $1"
    });

    expect(mocks.telemetrySpans).toHaveLength(1);
    expect(mocks.telemetrySpans[0]).toMatchObject({
      detail: {
        classification: 'read',
        operation: 'select',
        relations: ['users']
      },
      kind: 'postgres.query',
      name: 'select users'
    });
    expect(JSON.stringify(mocks.telemetrySpans)).not.toContain('sql');
    expect(JSON.stringify(mocks.telemetrySpans)).not.toContain('super-secret-token');
  });
});
