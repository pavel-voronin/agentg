import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/telemetry/index.js', () => ({
  incrementTelemetryCounter: vi.fn(),
  setTelemetryGauge: vi.fn(),
  timeTelemetrySpan: vi.fn((_input: unknown, operation: () => Promise<unknown>) => operation())
}));

import {
  createPolicyServer,
  definePolicy,
  POLICY_API_VERSION,
  type PolicyDocument,
  type PolicyStore
} from '../src/policies/index.js';
import * as telemetry from '../src/telemetry/index.js';

const policy = definePolicy({
  id: 'sample.rules',
  kind: 'SampleRule',
  moduleId: 'sample',
  spec: z.object({
    key: z.string(),
    mode: z.enum(['enabled', 'disabled'])
  }),
  version: 1
});

describe('policy telemetry', () => {
  beforeEach(() => {
    vi.mocked(telemetry.incrementTelemetryCounter).mockReset();
    vi.mocked(telemetry.setTelemetryGauge).mockReset();
    vi.mocked(telemetry.timeTelemetrySpan).mockClear();
  });

  it('records catalog state and bounded mutation labels', async () => {
    const server = createPolicyServer({
      catalog: [policy],
      store: memoryStore([
        document({
          name: 'alpha',
          spec: {
            key: 'alpha',
            mode: 'enabled'
          }
        })
      ])
    });

    await server.start();
    await server.procedures.setInstance({
      document: document({
        name: 'alpha',
        spec: {
          key: 'alpha',
          mode: 'disabled'
        }
      })
    });

    expect(telemetry.timeTelemetrySpan).toHaveBeenCalledWith(
      {
        metric: {
          name: 'policies.start.duration'
        },
        name: 'policies.start'
      },
      expect.any(Function)
    );
    expect(telemetry.setTelemetryGauge).toHaveBeenCalledWith('policies.kinds', 1);
    expect(telemetry.setTelemetryGauge).toHaveBeenCalledWith('policies.documents', 1, {
      'policy.kind': 'SampleRule',
      'policy.module_id': 'sample'
    });
    expect(telemetry.incrementTelemetryCounter).toHaveBeenCalledWith('policies.mutations', 1, {
      'error.type': 'none',
      'policy.kind': 'SampleRule',
      'policy.module_id': 'sample',
      'policy.mutation_status': 'applied',
      'policy.operation': 'set'
    });
    expect(telemetry.incrementTelemetryCounter).toHaveBeenCalledWith('policies.value_changes', 1, {
      'policy.kind': 'SampleRule',
      'policy.module_id': 'sample',
      'policy.operation': 'set'
    });
    expect(JSON.stringify(vi.mocked(telemetry.incrementTelemetryCounter).mock.calls)).not.toContain(
      'alpha'
    );
  });

  it('collapses rejected documents into a bounded telemetry label', async () => {
    const server = createPolicyServer({
      catalog: [policy],
      store: memoryStore([])
    });

    await server.start();
    await server.procedures.setInstance({
      document: document({
        kind: 'UnknownRule',
        name: 'external-agent-rule',
        spec: {
          key: 'alpha',
          mode: 'enabled'
        }
      })
    });

    expect(telemetry.incrementTelemetryCounter).toHaveBeenCalledWith('policies.mutations', 1, {
      'error.type': 'invalid_document',
      'policy.kind': 'unknown',
      'policy.module_id': 'unknown',
      'policy.mutation_status': 'rejected',
      'policy.operation': 'set'
    });
    const calls = JSON.stringify(vi.mocked(telemetry.incrementTelemetryCounter).mock.calls);
    expect(calls).not.toContain('UnknownRule');
    expect(calls).not.toContain('external-agent-rule');
  });
});

function document(input: {
  kind?: string;
  name: string;
  spec: PolicyDocument['spec'];
}): PolicyDocument {
  return {
    apiVersion: POLICY_API_VERSION,
    kind: input.kind ?? 'SampleRule',
    metadata: {
      name: input.name
    },
    spec: input.spec
  };
}

function memoryStore(initial: readonly PolicyDocument[]): PolicyStore {
  const documents = new Map(initial.map((item) => [`${item.kind}/${item.metadata.name}`, item]));
  return {
    delete(identity) {
      documents.delete(`${identity.kind}/${identity.name}`);
      return Promise.resolve();
    },
    loadAll() {
      return Promise.resolve([...documents.values()]);
    },
    set(item) {
      documents.set(`${item.kind}/${item.metadata.name}`, item);
      return Promise.resolve();
    }
  };
}
