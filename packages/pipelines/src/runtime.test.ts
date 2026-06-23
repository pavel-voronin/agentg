import { describe, expect, it, vi } from 'vitest';

import type { Dispatcher, ResultReader } from './actions.js';
import { createRuntime } from './runtime.js';
import type { Dataset, Document, ProviderResult, ProviderRunResult } from './schema.js';
import { createMemoryStore } from './store.js';
import type { RegistrationClient } from './triggers.js';

describe('pipelines runtime', () => {
  it('rejects malformed and cyclic pipeline documents', async () => {
    const runtime = runtimeWith();

    await expect(runtime.setPipeline({ document: 'not: [' })).resolves.toMatchObject({
      error: {
        code: 'pipeline_rejected'
      },
      status: 'rejected'
    });
    await expect(
      runtime.setPipeline({
        document: {
          apiVersion: 'agentg.dev/v1',
          kind: 'Pipeline',
          metadata: { name: 'cycle' },
          spec: {
            nodes: {
              a: { from: 'b', use: 'data.select', with: { model: 'telegram.chat' } },
              b: { from: 'a', use: 'data.render', with: { format: 'text', sourceRef: 'chat' } }
            }
          }
        }
      })
    ).resolves.toMatchObject({
      error: {
        code: 'pipeline_rejected'
      },
      status: 'rejected'
    });
  });

  it('runs nodes by dependencies and returns run views from listRuns', async () => {
    const calls: string[] = [];
    const runtime = runtimeWith({
      dispatcher: {
        dispatch: vi.fn((input: Parameters<Dispatcher['dispatch']>[0]) => {
          calls.push(input.nodeId);
          return Promise.resolve({
            dataset: dataset(input.nodeId),
            status: 'ready'
          } satisfies ProviderResult);
        })
      }
    });
    await runtime.setPipeline(summaryDocument('summary'));

    const accepted = await runtime.runPipeline({ name: 'summary' });

    expect(accepted).toMatchObject({ status: 'accepted' });
    expect(calls).toEqual(['chats', 'summary', 'save']);
    const run = await runtime.getRun({ runId: accepted.runId });
    expect(run?.status).toBe('completed');
    expect(nodeStatus(run, 'chats')).toBe('completed');
    expect(nodeStatus(run, 'summary')).toBe('completed');
    expect(nodeStatus(run, 'save')).toBe('completed');

    const runs = await runtime.listRuns({ status: 'completed' });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.runId).toBe(accepted.runId);
    expect(nodeStatus(runs[0] ?? null, 'summary')).toBe('completed');
  });

  it('fails the run when an action rejects', async () => {
    const runtime = runtimeWith({
      dispatcher: {
        dispatch: vi.fn((input: Parameters<Dispatcher['dispatch']>[0]) => {
          if (input.nodeId === 'summary') {
            return Promise.resolve({
              error: {
                code: 'provider_failed',
                message: 'model failed'
              },
              status: 'rejected'
            } satisfies ProviderResult);
          }
          return Promise.resolve({
            dataset: dataset(input.nodeId),
            status: 'ready'
          } satisfies ProviderResult);
        })
      }
    });
    await runtime.setPipeline(summaryDocument('summary'));

    const accepted = await runtime.runPipeline({ name: 'summary' });

    const run = await runtime.getRun({ runId: accepted.runId });
    expect(run?.status).toBe('failed');
    expect(nodeStatus(run, 'summary')).toBe('failed');
  });

  it('resumes accepted provider runs from provider completion events once', async () => {
    const calls: string[] = [];
    let readResult: ProviderRunResult = {
      runId: 'provider-run-1',
      status: 'processing'
    };
    const read = vi.fn<ResultReader['read']>(() => Promise.resolve(readResult));
    const results: ResultReader = { read };
    const runtime = runtimeWith({
      dispatcher: {
        dispatch: vi.fn((input: Parameters<Dispatcher['dispatch']>[0]) => {
          calls.push(input.nodeId);
          if (input.nodeId === 'summary') {
            return Promise.resolve({
              runId: 'provider-run-1',
              status: 'accepted'
            } satisfies ProviderResult);
          }
          return Promise.resolve({
            dataset: dataset(input.nodeId),
            status: 'ready'
          } satisfies ProviderResult);
        })
      },
      results
    });
    await runtime.setPipeline(summaryDocument('summary'));

    const accepted = await runtime.runPipeline({ name: 'summary' });

    const waitingRun = await runtime.getRun({ runId: accepted.runId });
    expect(waitingRun?.status).toBe('waiting');
    expect(nodeStatus(waitingRun, 'summary')).toBe('waiting');
    expect(nodeProviderRunId(waitingRun, 'summary')).toBe('provider-run-1');
    expect(calls).toEqual(['chats', 'summary']);
    read.mockClear();

    readResult = {
      dataset: dataset('summary'),
      runId: 'provider-run-1',
      status: 'completed'
    };
    const event = {
      nodeId: 'summary',
      pipelineRunId: accepted.runId,
      runId: 'provider-run-1',
      status: 'completed'
    };
    await runtime.resumeProviderRun(event);
    await runtime.resumeProviderRun(event);

    expect(calls).toEqual(['chats', 'summary', 'save']);
    expect(read).toHaveBeenCalledTimes(1);
    const completedRun = await runtime.getRun({ runId: accepted.runId });
    expect(completedRun?.status).toBe('completed');
    expect(nodeStatus(completedRun, 'summary')).toBe('completed');
    expect(nodeStatus(completedRun, 'save')).toBe('completed');
  });

  it('continues a recovered waiting node once when resume scans race', async () => {
    const calls: string[] = [];
    const read = vi.fn<ResultReader['read']>(() =>
      Promise.resolve({
        dataset: dataset('summary'),
        runId: 'provider-run-1',
        status: 'completed'
      } satisfies ProviderRunResult)
    );
    const runtime = runtimeWith({
      dispatcher: {
        dispatch: vi.fn((input: Parameters<Dispatcher['dispatch']>[0]) => {
          calls.push(input.nodeId);
          if (input.nodeId === 'summary') {
            return Promise.resolve({
              runId: 'provider-run-1',
              status: 'accepted'
            } satisfies ProviderResult);
          }
          return Promise.resolve({
            dataset: dataset(input.nodeId),
            status: 'ready'
          } satisfies ProviderResult);
        })
      },
      results: { read }
    });
    await runtime.setPipeline(summaryDocument('summary'));

    const accepted = await runtime.runPipeline({ name: 'summary' });
    await Promise.all([runtime.resumeWaitingRuns(), runtime.resumeWaitingRuns()]);

    expect(calls).toEqual(['chats', 'summary', 'save']);
    const completedRun = await runtime.getRun({ runId: accepted.runId });
    expect(completedRun?.status).toBe('completed');
    expect(nodeStatus(completedRun, 'save')).toBe('completed');
  });

  it('marks accepted provider failures on resume', async () => {
    const runtime = runtimeWith({
      dispatcher: {
        dispatch: vi.fn((input: Parameters<Dispatcher['dispatch']>[0]) => {
          if (input.nodeId === 'summary') {
            return Promise.resolve({
              runId: 'provider-run-1',
              status: 'accepted'
            } satisfies ProviderResult);
          }
          return Promise.resolve({
            dataset: dataset(input.nodeId),
            status: 'ready'
          } satisfies ProviderResult);
        })
      },
      results: {
        read: vi.fn(() =>
          Promise.resolve({
            error: {
              code: 'provider_failed',
              message: 'model failed'
            },
            runId: 'provider-run-1',
            status: 'failed'
          } satisfies ProviderRunResult)
        )
      }
    });
    await runtime.setPipeline(summaryDocument('summary'));

    const accepted = await runtime.runPipeline({ name: 'summary' });
    await runtime.resumeProviderRun({
      nodeId: 'summary',
      pipelineRunId: accepted.runId,
      runId: 'provider-run-1',
      status: 'failed'
    });

    const run = await runtime.getRun({ runId: accepted.runId });
    expect(run?.status).toBe('failed');
    expect(nodeStatus(run, 'summary')).toBe('failed');
    expect(nodeFailureCode(run, 'summary')).toBe('provider_failed');
  });

  it('does not block pipeline mutations behind a long running run', async () => {
    let releaseDispatch: ((result: ProviderResult) => void) | undefined;
    let resolveDispatchStarted: () => void = () => undefined;
    const dispatchStarted = new Promise<void>((resolve) => {
      resolveDispatchStarted = resolve;
    });
    const runtime = runtimeWith({
      dispatcher: {
        dispatch: vi.fn((input: Parameters<Dispatcher['dispatch']>[0]) => {
          if (input.nodeId === 'chats') {
            resolveDispatchStarted();
            return new Promise<ProviderResult>((resolve) => {
              releaseDispatch = resolve;
            });
          }
          return Promise.resolve({
            dataset: dataset(input.nodeId),
            status: 'ready'
          } satisfies ProviderResult);
        })
      }
    });
    await runtime.setPipeline(simpleDocument('slow'));

    const running = runtime.runPipeline({ name: 'slow' });
    await dispatchStarted;
    await expect(runtime.setPipeline(simpleDocument('scheduled'))).resolves.toMatchObject({
      name: 'scheduled',
      status: 'applied'
    });
    releaseDispatch?.({
      dataset: dataset('chats'),
      status: 'ready'
    });
    await expect(running).resolves.toMatchObject({ status: 'accepted' });
  });

  it('uses idempotency for triggered runs', async () => {
    const runtime = runtimeWith();
    await runtime.setPipeline(simpleDocument('triggered'));

    const first = await runtime.runTriggered(triggerInput('triggered', 'occurrence-1'));
    const second = await runtime.runTriggered(triggerInput('triggered', 'occurrence-1'));

    expect(first).toEqual(second);
  });

  it('resolves triggered context values and keeps them after provider resume', async () => {
    const calls: { nodeId: string; withInput: unknown }[] = [];
    let readResult: ProviderRunResult = {
      runId: 'provider-run-1',
      status: 'processing'
    };
    const runtime = runtimeWith({
      dispatcher: {
        dispatch: vi.fn((input: Parameters<Dispatcher['dispatch']>[0]) => {
          calls.push({ nodeId: input.nodeId, withInput: input.withInput });
          if (input.nodeId === 'summary') {
            return Promise.resolve({
              runId: 'provider-run-1',
              status: 'accepted'
            } satisfies ProviderResult);
          }
          return Promise.resolve({
            dataset: dataset(input.nodeId),
            status: 'ready'
          } satisfies ProviderResult);
        })
      },
      results: {
        read: vi.fn(() => Promise.resolve(readResult))
      }
    });
    await runtime.setPipeline(dailyDocument('daily'));

    const accepted = await runtime.runTriggered({
      actionInput: { pipelineName: 'daily', triggerName: 'everyDay' },
      occurrence: {
        idempotencyKey: 'occurrence-1',
        registrationKey: 'pipelines:daily:everyDay',
        scheduledAt: '2026-06-22T00:00:00.000Z'
      },
      trigger: { kind: 'trigger', requestId: 'occurrence-1' }
    });

    expect(accepted).toMatchObject({ status: 'accepted' });
    expect(calls).toEqual([
      {
        nodeId: 'messages',
        withInput: {
          model: 'telegram.message',
          where: {
            endAt: '2026-06-22T00:00:00.000Z',
            readState: 'unread',
            startAt: '2026-06-21T00:00:00.000Z'
          }
        }
      },
      {
        nodeId: 'summary',
        withInput: {
          profile: 'openrouterCheapSummary',
          prompt: 'Summarize unread messages.'
        }
      }
    ]);

    readResult = {
      dataset: dataset('summary'),
      runId: 'provider-run-1',
      status: 'completed'
    };
    await runtime.resumeProviderRun({
      nodeId: 'summary',
      pipelineRunId: accepted.runId,
      runId: 'provider-run-1',
      status: 'completed'
    });

    expect(calls.at(-1)).toEqual({
      nodeId: 'save',
      withInput: {
        itemId: '2026-06-21',
        key: 'dailyUnreadSummaries',
        mode: 'replace',
        subject: { ref: 'chat' },
        valueFrom: { field: 'value' }
      }
    });
    await expect(runtime.getRun({ runId: accepted.runId })).resolves.toMatchObject({
      context: {
        date: { utc: '2026-06-21' },
        trigger: { scheduledAt: '2026-06-22T00:00:00.000Z' },
        window: {
          endAt: '2026-06-22T00:00:00.000Z',
          startAt: '2026-06-21T00:00:00.000Z'
        }
      },
      status: 'completed'
    });
  });

  it('fails runs with unavailable context values', async () => {
    const dispatch = vi.fn<Dispatcher['dispatch']>(() =>
      Promise.resolve({
        dataset: dataset('messages'),
        status: 'ready'
      })
    );
    const runtime = runtimeWith({
      dispatcher: { dispatch }
    });
    await runtime.setPipeline({
      document: {
        apiVersion: 'agentg.dev/v1',
        kind: 'Pipeline',
        metadata: { name: 'brokenContext' },
        spec: {
          nodes: {
            messages: {
              use: 'data.select',
              with: {
                model: 'telegram.message',
                where: {
                  startAt: { $context: 'window.startAt' }
                }
              }
            }
          }
        }
      }
    });

    const accepted = await runtime.runPipeline({ name: 'brokenContext' });

    expect(dispatch).not.toHaveBeenCalled();
    await expect(runtime.getRun({ runId: accepted.runId })).resolves.toMatchObject({
      failureMessage: 'Pipeline context value is not available: window.startAt',
      status: 'failed'
    });
  });

  it('registers pipeline schedules with triggers on set and clears them on delete', async () => {
    const registration = registrationClient();
    const runtime = runtimeWith({ registration });

    await runtime.setPipeline(simpleDocument('scheduled'));
    await runtime.deletePipeline({ name: 'scheduled' });

    const replace = vi.mocked(registration.replace);
    expect(replace).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ metadata: { name: 'scheduled' } }),
      'scheduled'
    );
    expect(replace).toHaveBeenNthCalledWith(2, null, 'scheduled');
  });

  it('keeps definitions unchanged when trigger registration replacement fails', async () => {
    const registration = registrationClient();
    const runtime = runtimeWith({ registration });
    await runtime.setPipeline(simpleDocument('scheduled'));

    vi.mocked(registration.replace).mockRejectedValueOnce(new Error('triggers unavailable'));

    await expect(runtime.setPipeline(summaryDocument('scheduled'))).resolves.toMatchObject({
      error: {
        code: 'pipeline_rejected'
      },
      status: 'rejected'
    });
    const stored = await runtime.getPipeline({ name: 'scheduled' });
    expect(stored).not.toBeNull();
    expect(Object.keys(stored?.document.spec.nodes ?? {})).toEqual(['chats']);
  });

  it('keeps definitions when trigger registration clearing fails on delete', async () => {
    const registration = registrationClient();
    const runtime = runtimeWith({ registration });
    await runtime.setPipeline(simpleDocument('scheduled'));

    vi.mocked(registration.replace).mockRejectedValueOnce(new Error('triggers unavailable'));

    await expect(runtime.deletePipeline({ name: 'scheduled' })).resolves.toMatchObject({
      error: {
        code: 'pipeline_rejected'
      },
      name: 'scheduled',
      status: 'rejected'
    });
    await expect(runtime.getPipeline({ name: 'scheduled' })).resolves.toMatchObject({
      name: 'scheduled'
    });
  });
});

function runtimeWith(
  input: {
    dispatcher?: Dispatcher | undefined;
    registration?: RegistrationClient | undefined;
    results?: ResultReader | undefined;
  } = {}
) {
  return createRuntime({
    dispatcher:
      input.dispatcher ??
      ({
        dispatch: vi.fn(() =>
          Promise.resolve({
            dataset: { rows: [] },
            status: 'ready' as const
          })
        )
      } satisfies Dispatcher),
    registration: input.registration ?? registrationClient(),
    results:
      input.results ??
      ({
        read: vi.fn(() =>
          Promise.resolve({
            runId: 'provider-run',
            status: 'processing' as const
          })
        )
      } satisfies ResultReader),
    store: createMemoryStore()
  });
}

function simpleDocument(name: string): { document: Document } {
  return {
    document: {
      apiVersion: 'agentg.dev/v1',
      kind: 'Pipeline',
      metadata: { name },
      spec: {
        nodes: {
          chats: { use: 'data.select', with: { model: 'telegram.chat' } }
        },
        triggers: {
          everyMinute: { everySeconds: 60, kind: 'periodic' }
        }
      }
    }
  };
}

function dailyDocument(name: string): { document: Document } {
  return {
    document: {
      apiVersion: 'agentg.dev/v1',
      kind: 'Pipeline',
      metadata: { name },
      spec: {
        nodes: {
          messages: {
            use: 'data.select',
            with: {
              model: 'telegram.message',
              where: {
                endAt: { $context: 'window.endAt' },
                readState: 'unread',
                startAt: { $context: 'window.startAt' }
              }
            }
          },
          save: {
            from: 'summary',
            use: 'data.writeCollectionItem',
            with: {
              itemId: { $context: 'date.utc' },
              key: 'dailyUnreadSummaries',
              mode: 'replace',
              subject: { ref: 'chat' },
              valueFrom: { field: 'value' }
            }
          },
          summary: {
            from: 'messages',
            use: 'llm.run',
            with: {
              profile: 'openrouterCheapSummary',
              prompt: 'Summarize unread messages.'
            }
          }
        },
        triggers: {
          everyDay: { everySeconds: 86400, kind: 'periodic' }
        }
      }
    }
  };
}

function summaryDocument(name: string): { document: Document } {
  return {
    document: {
      apiVersion: 'agentg.dev/v1',
      kind: 'Pipeline',
      metadata: { name },
      spec: {
        nodes: {
          save: {
            from: 'summary',
            use: 'data.writeAnnotation',
            with: { key: 'summary', mode: 'replace', subject: { ref: 'chat' } }
          },
          chats: { use: 'data.select', with: { model: 'telegram.chat' } },
          summary: { from: 'chats', use: 'llm.run', with: { profile: 'default', prompt: 'sum' } }
        }
      }
    }
  };
}

function dataset(value: string): Dataset {
  return {
    rows: [
      {
        lineage: [],
        refs: { chat: { _model: 'telegram.chat', id: '10' } },
        value
      }
    ]
  };
}

function triggerInput(name: string, idempotencyKey: string) {
  return {
    actionInput: { pipelineName: name, triggerName: 'everyMinute' },
    occurrence: {
      idempotencyKey,
      registrationKey: `pipelines:${name}:everyMinute`,
      scheduledAt: '2026-06-20T00:00:00.000Z'
    },
    trigger: { kind: 'trigger', requestId: idempotencyKey }
  };
}

function registrationClient(): RegistrationClient {
  return {
    replace: vi.fn<RegistrationClient['replace']>((_document, name) =>
      Promise.resolve([
        {
          key: `${name}:everyMinute`,
          registrationKey: `pipelines:${name}:everyMinute`,
          triggerName: 'everyMinute'
        }
      ])
    )
  };
}

type RunView = NonNullable<Awaited<ReturnType<ReturnType<typeof runtimeWith>['getRun']>>>;

function nodeStatus(run: RunView | null | undefined, nodeId: string): string | undefined {
  return run?.nodes.find((node) => node.nodeId === nodeId)?.status;
}

function nodeProviderRunId(run: RunView | null | undefined, nodeId: string): string | undefined {
  return run?.nodes.find((node) => node.nodeId === nodeId)?.providerRunId;
}

function nodeFailureCode(run: RunView | null | undefined, nodeId: string): string | undefined {
  return run?.nodes.find((node) => node.nodeId === nodeId)?.failureCode;
}
