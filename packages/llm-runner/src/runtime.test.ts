import { describe, expect, it, vi } from 'vitest';
import type { JsonValue } from '@agentg/framework';

import type { EventPublisher } from './events.js';
import type { ProfileRunner } from './profiles/types.js';
import { createRuntime, type Runtime } from './runtime.js';
import { createMemoryStore, inputMetadata, type Store } from './store.js';

describe('LLM action runtime', () => {
  it('completes an empty input without provider calls', async () => {
    const profiles = profileRunner();
    const runtime = createRuntime({
      events: events(),
      profiles,
      store: createMemoryStore()
    });

    const result = await runtime.run(request({ rows: [] }));
    const runId = acceptedRunId(result);

    expect(result).toMatchObject({
      status: 'accepted'
    });
    expect(await expectCompleted(runtime, runId)).toMatchObject({
      dataset: {
        rows: []
      },
      status: 'completed'
    });
    expect(profiles.process).not.toHaveBeenCalled();
  });

  it('uses one run id and one provider call per input row', async () => {
    const profiles = profileRunner(['first', 'second']);
    const runtime = createRuntime({
      events: events(),
      profiles,
      store: createMemoryStore()
    });

    const result = await runtime.run(
      request({
        rows: [
          {
            lineage: [{ _model: 'telegram.chat', id: '10' }],
            refs: {
              chat: { _model: 'telegram.chat', id: '10' }
            },
            value: 'hello'
          },
          {
            lineage: [{ _model: 'telegram.chat', id: '20' }],
            refs: {
              chat: { _model: 'telegram.chat', id: '20' }
            },
            value: 'world'
          }
        ]
      })
    );
    const runId = acceptedRunId(result);

    expect(result.status).toBe('accepted');
    const completed = await expectCompleted(runtime, runId);
    expect(completed.dataset.rows).toEqual([
      {
        lineage: [{ _model: 'telegram.chat', id: '10' }],
        refs: {
          chat: { _model: 'telegram.chat', id: '10' }
        },
        value: 'first'
      },
      {
        lineage: [{ _model: 'telegram.chat', id: '20' }],
        refs: {
          chat: { _model: 'telegram.chat', id: '20' }
        },
        value: 'second'
      }
    ]);
    expect(profiles.process).toHaveBeenCalledTimes(2);
    expect(await runtime.getRunResult({ runId })).toEqual({
      dataset: completed.dataset,
      runId,
      status: 'completed'
    });
  });

  it('rejects unknown profiles before provider calls', async () => {
    const profiles = profileRunner();
    profiles.hasProfile = vi.fn(() => false);
    const runtime = createRuntime({
      events: events(),
      profiles,
      store: createMemoryStore()
    });

    await expect(runtime.run(request())).resolves.toEqual({
      error: {
        code: 'unknown_profile',
        message: 'LLM profile is not configured: default'
      },
      status: 'rejected'
    });
    expect(profiles.process).not.toHaveBeenCalled();
  });

  it('fails the whole action when one provider call fails', async () => {
    const profiles = profileRunner();
    profiles.process = vi
      .fn()
      .mockResolvedValueOnce({ text: 'ok' })
      .mockRejectedValueOnce(new Error('provider down'));
    const runtime = createRuntime({
      events: events(),
      profiles,
      store: createMemoryStore()
    });

    const result = await runtime.run(
      request({
        rows: [
          { lineage: [], refs: {}, value: 'first' },
          { lineage: [], refs: {}, value: 'second' }
        ]
      })
    );
    const runId = acceptedRunId(result);

    expect(result.status).toBe('accepted');
    expect(typeof runId).toBe('string');
    expect(await expectFailed(runtime, runId)).toEqual({
      error: {
        code: 'provider_failed',
        message: 'provider down'
      },
      runId,
      status: 'failed'
    });
    expect(profiles.process).toHaveBeenCalledTimes(2);
  });

  it('parses JSON output when requested', async () => {
    const profiles = profileRunner(['{"summary":"ok"}']);
    const runtime = createRuntime({
      events: events(),
      profiles,
      store: createMemoryStore()
    });

    const result = await runtime.run(
      request({
        output: { format: 'json' },
        rows: [{ lineage: [], refs: {}, value: 'input' }]
      })
    );
    const runId = acceptedRunId(result);

    expect(result).toMatchObject({
      status: 'accepted'
    });
    expect(await expectCompleted(runtime, runId)).toMatchObject({
      dataset: {
        rows: [
          {
            lineage: [],
            refs: {},
            value: {
              summary: 'ok'
            }
          }
        ]
      },
      status: 'completed'
    });
  });

  it('keeps completed state when processing event publication fails', async () => {
    const runtime = createRuntime({
      events: events({
        runProcessing: vi.fn(() => {
          throw new Error('nats down');
        })
      }),
      profiles: profileRunner(),
      store: createMemoryStore()
    });

    const result = await runtime.run(request());
    const runId = acceptedRunId(result);

    expect(await expectCompleted(runtime, runId)).toMatchObject({
      status: 'completed'
    });
  });

  it('keeps completed state when completed event publication fails', async () => {
    const runtime = createRuntime({
      events: events({
        runCompleted: vi.fn(() => {
          throw new Error('nats down');
        })
      }),
      profiles: profileRunner(),
      store: createMemoryStore()
    });

    const result = await runtime.run(request());
    const runId = acceptedRunId(result);

    expect(await expectCompleted(runtime, runId)).toMatchObject({
      status: 'completed'
    });
  });

  it('keeps failed state when failed event publication fails', async () => {
    const profiles = profileRunner();
    profiles.process = vi.fn().mockRejectedValue(new Error('provider down'));
    const runtime = createRuntime({
      events: events({
        runFailed: vi.fn(() => {
          throw new Error('nats down');
        })
      }),
      profiles,
      store: createMemoryStore()
    });

    const result = await runtime.run(request());
    const runId = acceptedRunId(result);

    expect(await expectFailed(runtime, runId)).toMatchObject({
      error: {
        code: 'provider_failed',
        message: 'provider down'
      },
      status: 'failed'
    });
  });

  it('recovers stored accepted runs after runtime restart', async () => {
    const store = createMemoryStore();
    const run = await store.createRun({
      inputDataset: {
        rows: [{ lineage: [], refs: {}, value: 'input' }]
      },
      inputMetadata: inputMetadata(1, 'json'),
      nodeId: 'summary',
      now: new Date('2026-06-21T00:00:00.000Z'),
      pipelineRunId: 'pipeline-run-1',
      profile: 'default',
      prompt: 'Summarize.',
      status: 'accepted'
    });
    const profiles = profileRunner(['{"summary":"recovered"}']);
    const runCompleted = vi.fn();
    const runProcessing = vi.fn();
    const runtime = createRuntime({
      events: events({ runCompleted, runProcessing }),
      profiles,
      store
    });

    await expect(runtime.recoverActiveRuns()).resolves.toEqual({
      failed: 0,
      started: 1
    });

    await expect(expectCompleted(runtime, run.runId)).resolves.toMatchObject({
      dataset: {
        rows: [
          {
            lineage: [],
            refs: {},
            value: {
              summary: 'recovered'
            }
          }
        ]
      },
      status: 'completed'
    });
    expect(profiles.process).toHaveBeenCalledTimes(1);
    expect(runProcessing).toHaveBeenCalledWith(
      expect.objectContaining({ runId: run.runId, status: 'processing' })
    );
    expect(runCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ runId: run.runId, status: 'completed' })
    );
  });

  it('claims recovered accepted runs once across runtime instances', async () => {
    const baseStore = createMemoryStore();
    const store = racingCandidateStore(baseStore);
    const run = await baseStore.createRun({
      inputDataset: {
        rows: [{ lineage: [], refs: {}, value: 'input' }]
      },
      inputMetadata: inputMetadata(1, 'text'),
      nodeId: 'summary',
      now: new Date('2026-06-21T00:00:00.000Z'),
      pipelineRunId: 'pipeline-run-1',
      profile: 'default',
      prompt: 'Summarize.',
      status: 'accepted'
    });
    let finish: (() => void) | undefined;
    const profiles = profileRunner();
    profiles.process = vi.fn(
      () =>
        new Promise<{ text: string }>((resolve) => {
          finish = () => resolve({ text: 'done' });
        })
    );
    const first = createRuntime({
      events: events(),
      profiles,
      store
    });
    const second = createRuntime({
      events: events(),
      profiles,
      store
    });

    const results = await Promise.all([
      first.recoverActiveRuns(new Date('2026-06-21T00:00:01.000Z')),
      second.recoverActiveRuns(new Date('2026-06-21T00:00:01.000Z'))
    ]);

    expect(results.reduce((sum, result) => sum + result.started, 0)).toBe(1);
    expect(results.reduce((sum, result) => sum + result.failed, 0)).toBe(0);
    await delay();
    expect(profiles.process).toHaveBeenCalledTimes(1);

    finish?.();
    await expect(expectCompleted(first, run.runId)).resolves.toMatchObject({
      status: 'completed'
    });
  });

  it('does not recover runs already active in the current process', async () => {
    let finish: (() => void) | undefined;
    const profiles = profileRunner();
    profiles.process = vi.fn(
      () =>
        new Promise<{ text: string }>((resolve) => {
          finish = () => resolve({ text: 'done' });
        })
    );
    const runtime = createRuntime({
      events: events(),
      profiles,
      store: createMemoryStore()
    });

    const result = await runtime.run(request());
    const runId = acceptedRunId(result);

    await expect(runtime.recoverActiveRuns()).resolves.toEqual({
      failed: 0,
      started: 0
    });
    expect(profiles.process).toHaveBeenCalledTimes(1);

    finish?.();
    await expect(expectCompleted(runtime, runId)).resolves.toMatchObject({
      status: 'completed'
    });
  });

  it('fails active stored runs whose profile no longer exists', async () => {
    const store = createMemoryStore();
    const run = await store.createRun({
      inputDataset: {
        rows: [{ lineage: [], refs: {}, value: 'input' }]
      },
      inputMetadata: inputMetadata(1, 'text'),
      nodeId: 'summary',
      now: new Date('2026-06-21T00:00:00.000Z'),
      pipelineRunId: 'pipeline-run-1',
      profile: 'deleted',
      prompt: 'Summarize.',
      status: 'processing'
    });
    const profiles = profileRunner();
    profiles.hasProfile = vi.fn(() => false);
    const runtime = createRuntime({
      claimStaleMs: 1_000,
      events: events(),
      profiles,
      store
    });

    await expect(runtime.recoverActiveRuns(new Date('2026-06-21T00:00:02.000Z'))).resolves.toEqual({
      failed: 1,
      started: 0
    });

    await expect(runtime.getRunResult({ runId: run.runId })).resolves.toEqual({
      error: {
        code: 'unknown_profile',
        message: 'LLM profile is not configured: deleted'
      },
      runId: run.runId,
      status: 'failed'
    });
    expect(profiles.process).not.toHaveBeenCalled();
  });
});

function request(
  input: {
    output?: { format: 'json' | 'text' } | undefined;
    rows?: {
      lineage: { _model: string; id: string }[];
      refs: Record<string, { _model: string; id: string }>;
      value: JsonValue;
    }[];
  } = {}
) {
  return {
    input: {
      rows: input.rows ?? [{ lineage: [], refs: {}, value: 'hello' }]
    },
    node: {
      id: 'summary',
      runId: 'pipeline-run-1'
    },
    with: {
      ...(input.output === undefined ? {} : { output: input.output }),
      profile: 'default',
      prompt: 'Summarize.'
    }
  };
}

function profileRunner(outputs: readonly string[] = ['summary']): ProfileRunner {
  let index = 0;
  return {
    hasProfile: vi.fn(() => true),
    process: vi.fn(() => {
      const text = outputs[index] ?? outputs.at(-1) ?? '';
      index += 1;
      return Promise.resolve({
        text
      });
    })
  };
}

function events(overrides: Partial<EventPublisher> = {}): EventPublisher {
  return {
    runAccepted: vi.fn(),
    runCompleted: vi.fn(),
    runFailed: vi.fn(),
    runProcessing: vi.fn(),
    ...overrides
  };
}

function racingCandidateStore(store: Store): Store {
  let listed = 0;
  let release: () => void = () => undefined;
  const bothListed = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    ...store,
    async listActiveRuns() {
      const snapshot = await store.listActiveRuns();
      listed += 1;
      if (listed === 2) {
        release();
      }
      await bothListed;
      return snapshot;
    }
  };
}

function acceptedRunId(result: Awaited<ReturnType<Runtime['run']>>): string {
  if (result.status !== 'accepted') {
    throw new Error(`Expected accepted run result: ${JSON.stringify(result)}`);
  }
  return result.runId;
}

async function expectCompleted(runtime: Runtime, runId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await runtime.getRunResult({ runId });
    if (result?.status === 'completed') {
      return result;
    }
    await delay();
  }
  throw new Error(`LLM run did not complete: ${runId}`);
}

async function expectFailed(runtime: Runtime, runId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await runtime.getRunResult({ runId });
    if (result?.status === 'failed') {
      return result;
    }
    await delay();
  }
  throw new Error(`LLM run did not fail: ${runId}`);
}

function delay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
