import { describe, expect, it } from 'vitest';

import type { EventPublisher } from './events.js';
import type { ProcessingInput, ProcessingOutput, ProfileRunner } from './profiles/types.js';
import { createRuntime, startRuntimeLoop } from './runtime.js';
import {
  llmRunPayloadSchema,
  runTriggeredInputSchema,
  type LlmRunPayload,
  type SourceRef
} from './schema.js';
import type { SourceResolver, SourceResolution, SourceSnapshot } from './sources/types.js';
import { createMemoryStore, type Store } from './store.js';

describe('LLM run payload', () => {
  it('validates the direct run shape', () => {
    expect(() => llmRunPayloadSchema.parse(payload())).not.toThrow();
    expect(() =>
      llmRunPayloadSchema.parse({
        ...payload(),
        profile: ''
      })
    ).toThrow();
  });

  it('validates the triggered action-provider shape', () => {
    expect(() =>
      runTriggeredInputSchema.parse({
        actionInput: payload(),
        occurrence: {
          idempotencyKey: 'occurrence-1',
          registrationKey: 'TriggerRule:daily',
          scheduledAt: '2026-01-01T00:00:00.000Z'
        },
        trigger: {
          kind: 'trigger',
          requestId: 'occurrence-1'
        }
      })
    ).not.toThrow();

    expect(() =>
      runTriggeredInputSchema.parse({
        actionInput: {
          ...payload(),
          instructions: ''
        },
        occurrence: {
          idempotencyKey: 'occurrence-1',
          registrationKey: 'TriggerRule:daily',
          scheduledAt: '2026-01-01T00:00:00.000Z'
        },
        trigger: {
          kind: 'trigger',
          requestId: 'occurrence-1'
        }
      })
    ).toThrow();
  });
});

describe('LLM runner runtime', () => {
  it('rejects an unknown profile before resolving source content', async () => {
    let resolverCalls = 0;
    const runtime = createRuntime({
      events: eventRecorder(),
      profiles: profileRunner({ profiles: [] }),
      sources: {
        resolve() {
          resolverCalls += 1;
          return Promise.resolve(readyResolution());
        }
      },
      store: createMemoryStore()
    });

    await expect(runtime.run(payload())).resolves.toEqual({
      error: {
        code: 'unknown_profile',
        message: 'LLM profile is not configured: default'
      },
      status: 'rejected'
    });
    expect(resolverCalls).toBe(0);
    await expect(
      runtime.getCurrentArtifact({
        artifactKey: 'daily',
        sourceRef: chatSource('10')
      })
    ).resolves.toEqual({
      artifact: null
    });
  });

  it('processes a direct run and stores the current artifact by source ref', async () => {
    const runtime = createRuntime({
      events: eventRecorder(),
      profiles: profileRunner({ output: 'summary' }),
      sources: sourceResolver([readyResolution()]),
      store: createMemoryStore()
    });

    const accepted = await runtime.run(payload(), new Date('2026-01-01T00:00:00.000Z'));
    expect(accepted).toEqual({
      runId: 'run_1',
      status: 'accepted'
    });
    await expect(runtime.processQueuedRuns(new Date('2026-01-01T00:00:01.000Z'))).resolves.toEqual({
      processed: 1
    });

    await expect(
      runtime.getCurrentArtifact({
        artifactKey: 'daily',
        sourceRef: chatSource('10')
      })
    ).resolves.toMatchObject({
      artifact: {
        artifactKey: 'daily',
        body: 'summary',
        contentRefs: [
          {
            _model: 'telegram.message',
            id: '10:100',
            sourceRef: chatSource('10')
          }
        ],
        profile: 'default',
        runId: 'run_1',
        sourceRef: chatSource('10'),
        sourceRefs: [chatSource('10')],
        status: 'current'
      }
    });
  });

  it('passes source selectors to the source domain resolver and profile instructions to the provider', async () => {
    const profiles = profileRunner();
    const sources = sourceResolver([readyResolution()]);
    const runtime = createRuntime({
      events: eventRecorder(),
      profiles,
      sources,
      store: createMemoryStore()
    });

    await runtime.run(payload());
    await runtime.processQueuedRuns();

    expect(sources.calls).toEqual([
      {
        sourceSelector: {
          domain: 'telegram',
          selector: {
            chatId: '10',
            kind: 'recentMessages',
            limit: 20
          }
        }
      }
    ]);
    expect(profiles.calls[0]).toMatchObject({
      artifactKey: 'daily',
      instructions: 'Summarize important unread signals.',
      profile: 'default',
      sourceRefs: [chatSource('10')]
    });
  });

  it('deduplicates triggered dispatch by occurrence idempotency key', async () => {
    const events = eventRecorder();
    const runtime = createRuntime({
      events,
      profiles: profileRunner(),
      sources: sourceResolver([readyResolution()]),
      store: createMemoryStore()
    });
    const triggered = {
      payload: payload(),
      provenance: {
        occurrence: {
          idempotencyKey: 'occurrence-1',
          registrationKey: 'TriggerRule:daily',
          scheduledAt: '2026-01-01T00:00:00.000Z'
        },
        trigger: {
          kind: 'trigger' as const,
          requestId: 'occurrence-1'
        }
      }
    };

    await expect(runtime.runTriggered(triggered)).resolves.toEqual({
      runId: 'run_1',
      status: 'accepted'
    });
    await expect(runtime.runTriggered(triggered)).resolves.toEqual({
      runId: 'run_1',
      status: 'accepted'
    });
    await expect(runtime.processQueuedRuns()).resolves.toEqual({
      processed: 1
    });
    expect(events.accepted).toHaveLength(1);
    expect(events.artifacts[0]).toMatchObject({
      runId: 'run_1',
      trigger: triggered.provenance
    });
  });

  it('keeps the same run while source readiness moves from pending to ready', async () => {
    const profiles = profileRunner({ output: 'ready summary' });
    const runtime = createRuntime({
      events: eventRecorder(),
      profiles,
      sources: sourceResolver([
        {
          requestId: 'source-request-1',
          status: 'pending'
        },
        readyResolution()
      ]),
      store: createMemoryStore()
    });

    await expect(runtime.run(payload())).resolves.toEqual({
      runId: 'run_1',
      status: 'accepted'
    });
    await expect(runtime.processQueuedRuns()).resolves.toEqual({
      processed: 1
    });
    await expect(
      runtime.getCurrentArtifact({
        artifactKey: 'daily',
        sourceRef: chatSource('10')
      })
    ).resolves.toEqual({
      artifact: null
    });
    expect(profiles.calls).toHaveLength(0);
    await expect(runtime.processQueuedRuns()).resolves.toEqual({
      processed: 1
    });
    await expect(
      runtime.getCurrentArtifact({
        artifactKey: 'daily',
        sourceRef: chatSource('10')
      })
    ).resolves.toMatchObject({
      artifact: {
        body: 'ready summary',
        runId: 'run_1'
      }
    });
  });

  it('resumes durable accepted and waiting runs after runtime restart', async () => {
    const store = createMemoryStore();
    const first = createRuntime({
      events: eventRecorder(),
      profiles: profileRunner(),
      sources: sourceResolver([
        {
          requestId: 'source-request-1',
          status: 'pending'
        }
      ]),
      store
    });

    await expect(first.run(payload())).resolves.toEqual({
      runId: 'run_1',
      status: 'accepted'
    });
    await expect(first.processQueuedRuns()).resolves.toEqual({
      processed: 1
    });

    const second = createRuntime({
      events: eventRecorder(),
      profiles: profileRunner({ output: 'after restart' }),
      sources: sourceResolver([readyResolution()]),
      store
    });
    await expect(second.processQueuedRuns()).resolves.toEqual({
      processed: 1
    });
    await expect(
      second.getCurrentArtifact({
        artifactKey: 'daily',
        sourceRef: chatSource('10')
      })
    ).resolves.toMatchObject({
      artifact: {
        body: 'after restart',
        runId: 'run_1'
      }
    });
    await expect(second.processQueuedRuns()).resolves.toEqual({
      processed: 0
    });
  });

  it('fails source resolution before provider processing', async () => {
    const events = eventRecorder();
    const profiles = profileRunner();
    const runtime = createRuntime({
      events,
      profiles,
      sources: {
        resolve() {
          throw new Error('source down');
        }
      },
      store: createMemoryStore()
    });

    await runtime.run(payload());
    await runtime.processQueuedRuns();

    expect(profiles.calls).toHaveLength(0);
    expect(events.failed).toMatchObject([
      {
        failureCode: 'source_resolution_failed',
        runId: 'run_1'
      }
    ]);
  });

  it('fails zero-source ready resolutions before provider processing', async () => {
    const events = eventRecorder();
    const profiles = profileRunner();
    const runtime = createRuntime({
      events,
      profiles,
      sources: sourceResolver([
        readyResolution({
          contentRefs: [],
          sourceRefs: []
        })
      ]),
      store: createMemoryStore()
    });

    await runtime.run(payload());
    await runtime.processQueuedRuns();

    expect(profiles.calls).toHaveLength(0);
    expect(events.failed).toMatchObject([
      {
        failureCode: 'source_refs_empty',
        runId: 'run_1'
      }
    ]);
  });

  it('completes empty ready content without provider processing or artifact update', async () => {
    const events = eventRecorder();
    const profiles = profileRunner();
    const runtime = createRuntime({
      events,
      profiles,
      sources: sourceResolver([
        readyResolution({
          contentRefs: [],
          payload: {
            messages: []
          },
          sourceRefs: [chatSource('10')]
        })
      ]),
      store: createMemoryStore()
    });

    await runtime.run(payload());
    await runtime.processQueuedRuns();

    expect(profiles.calls).toHaveLength(0);
    expect(events.completed).toMatchObject([
      {
        contentRefs: [],
        runId: 'run_1',
        sourceRefs: [chatSource('10')]
      }
    ]);
    expect(events.artifacts).toEqual([]);
    await expect(
      runtime.getCurrentArtifact({
        artifactKey: 'daily',
        sourceRef: chatSource('10')
      })
    ).resolves.toEqual({
      artifact: null
    });
  });

  it('records provider and artifact failures without writing artifacts', async () => {
    const providerEvents = eventRecorder();
    const providerRuntime = createRuntime({
      events: providerEvents,
      profiles: profileRunner({ failure: new Error('provider down') }),
      sources: sourceResolver([readyResolution()]),
      store: createMemoryStore()
    });

    await providerRuntime.run(payload());
    await providerRuntime.processQueuedRuns();
    expect(providerEvents.failed).toMatchObject([
      {
        failureCode: 'processing_failed',
        runId: 'run_1'
      }
    ]);
    await expect(
      providerRuntime.getCurrentArtifact({
        artifactKey: 'daily',
        sourceRef: chatSource('10')
      })
    ).resolves.toEqual({
      artifact: null
    });

    const artifactEvents = eventRecorder();
    const artifactRuntime = createRuntime({
      events: artifactEvents,
      profiles: profileRunner(),
      sources: sourceResolver([readyResolution()]),
      store: failingArtifactStore()
    });
    await artifactRuntime.run(payload());
    await artifactRuntime.processQueuedRuns();
    expect(artifactEvents.failed).toMatchObject([
      {
        failureCode: 'processing_failed',
        runId: 'run_1'
      }
    ]);
  });

  it('rejects invalid provider output before artifact storage', async () => {
    const events = eventRecorder();
    const runtime = createRuntime({
      events,
      profiles: profileRunner({
        output: {
          body: undefined
        } as unknown as ProcessingOutput
      }),
      sources: sourceResolver([readyResolution()]),
      store: createMemoryStore()
    });

    await runtime.run(payload());
    await runtime.processQueuedRuns();

    expect(events.failed).toMatchObject([
      {
        failureCode: 'processing_failed',
        runId: 'run_1'
      }
    ]);
    await expect(
      runtime.getCurrentArtifact({
        artifactKey: 'daily',
        sourceRef: chatSource('10')
      })
    ).resolves.toEqual({
      artifact: null
    });
  });

  it('indexes current artifacts by each associated source ref and replaces newer output', async () => {
    const runtime = createRuntime({
      events: eventRecorder(),
      profiles: profileRunner({ output: 'first summary' }),
      sources: sourceResolver([
        readyResolution({
          sourceRefs: [chatSource('10'), chatSource('20')]
        }),
        readyResolution({
          sourceRefs: [chatSource('10'), chatSource('20')]
        })
      ]),
      store: createMemoryStore()
    });

    await runtime.run(payload());
    await runtime.processQueuedRuns();
    await expect(
      runtime.listArtifacts({
        sourceRef: chatSource('20')
      })
    ).resolves.toMatchObject({
      artifacts: [
        {
          artifactKey: 'daily',
          body: 'first summary',
          sourceRef: chatSource('20'),
          sourceRefs: [chatSource('10'), chatSource('20')]
        }
      ]
    });

    await runtime.run({
      ...payload(),
      instructions: 'Summarize again.'
    });
    await runtime.processQueuedRuns();
    await expect(
      runtime.getCurrentArtifact({
        artifactKey: 'daily',
        sourceRef: chatSource('10')
      })
    ).resolves.toMatchObject({
      artifact: {
        body: 'first summary',
        runId: 'run_2'
      }
    });
  });

  it('publishes lifecycle events without raw instructions or source payload', async () => {
    const events = eventRecorder();
    const runtime = createRuntime({
      events,
      profiles: profileRunner(),
      sources: sourceResolver([readyResolution()]),
      store: createMemoryStore()
    });

    await runtime.run(payload());
    await runtime.processQueuedRuns();

    expect(events.accepted).toHaveLength(1);
    expect(events.processing).toHaveLength(1);
    expect(events.completed).toHaveLength(1);
    expect(events.artifacts).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain('Summarize important unread signals.');
    expect(JSON.stringify(events)).not.toContain('hello');
  });

  it('waits for the active processing tick during shutdown', async () => {
    let finish: (() => void) | undefined;
    let stopped = false;
    const stop = startRuntimeLoop({
      intervalMs: 60_000,
      runtime: {
        getCurrentArtifact: () =>
          Promise.resolve({
            artifact: null
          }),
        listArtifacts: () =>
          Promise.resolve({
            artifacts: []
          }),
        processQueuedRuns: () =>
          new Promise((resolve) => {
            finish = () => {
              resolve({
                processed: 0
              });
            };
          }),
        run: () =>
          Promise.resolve({
            runId: 'run_1',
            status: 'accepted'
          }),
        runTriggered: () =>
          Promise.resolve({
            runId: 'run_1',
            status: 'accepted'
          })
      }
    });

    const stopPromise = stop().then(() => {
      stopped = true;
    });
    await nextTick();
    expect(stopped).toBe(false);

    finish?.();
    await stopPromise;
    expect(stopped).toBe(true);
  });
});

function payload(): LlmRunPayload {
  return {
    artifactKey: 'daily',
    instructions: 'Summarize important unread signals.',
    profile: 'default',
    sourceSelector: {
      domain: 'telegram',
      selector: {
        chatId: '10',
        kind: 'recentMessages',
        limit: 20
      }
    }
  };
}

function readyResolution(snapshot: Partial<SourceSnapshot> = {}): SourceResolution {
  return {
    snapshot: {
      contentRefs: snapshot.contentRefs ?? [
        {
          _model: 'telegram.message',
          id: '10:100',
          sourceRef: chatSource('10')
        }
      ],
      payload: snapshot.payload ?? {
        messages: [
          {
            chatId: '10',
            messageId: '100',
            text: 'hello'
          }
        ]
      },
      sourceRefs: snapshot.sourceRefs ?? [chatSource('10')]
    },
    status: 'ready'
  };
}

function profileRunner(
  input: {
    failure?: Error | undefined;
    output?: ProcessingOutput | string | undefined;
    profiles?: string[] | undefined;
  } = {}
): ProfileRunner & { calls: ProcessingInput[] } {
  const profiles = new Set(input.profiles ?? ['default']);
  const calls: ProcessingInput[] = [];
  return {
    calls,
    hasProfile(profile) {
      return profiles.has(profile);
    },
    process(request) {
      calls.push(request);
      if (input.failure !== undefined) {
        return Promise.reject(input.failure);
      }
      if (typeof input.output === 'object') {
        return Promise.resolve(input.output);
      }
      return Promise.resolve({
        body: input.output ?? 'summary'
      });
    }
  };
}

function sourceResolver(
  resolutions: SourceResolution[]
): SourceResolver & { calls: Parameters<SourceResolver['resolve']>[0][] } {
  const calls: Parameters<SourceResolver['resolve']>[0][] = [];
  return {
    calls,
    resolve(input) {
      calls.push(input);
      const next = resolutions.shift();
      if (next === undefined) {
        throw new Error('Source resolver was called too many times');
      }
      return Promise.resolve(next);
    }
  };
}

function eventRecorder(): EventPublisher & {
  accepted: Parameters<EventPublisher['runAccepted']>[0][];
  artifacts: Parameters<EventPublisher['artifactUpdated']>[0][];
  completed: Parameters<EventPublisher['runCompleted']>[0][];
  failed: Parameters<EventPublisher['runFailed']>[0][];
  processing: Parameters<EventPublisher['runProcessing']>[0][];
  waiting: Parameters<EventPublisher['runWaitingForSource']>[0][];
} {
  const accepted: Parameters<EventPublisher['runAccepted']>[0][] = [];
  const artifacts: Parameters<EventPublisher['artifactUpdated']>[0][] = [];
  const completed: Parameters<EventPublisher['runCompleted']>[0][] = [];
  const failed: Parameters<EventPublisher['runFailed']>[0][] = [];
  const processing: Parameters<EventPublisher['runProcessing']>[0][] = [];
  const waiting: Parameters<EventPublisher['runWaitingForSource']>[0][] = [];
  return {
    accepted,
    artifactUpdated: (event) => {
      artifacts.push(event);
    },
    artifacts,
    completed,
    failed,
    processing,
    runAccepted: (event) => {
      accepted.push(event);
    },
    runCompleted: (event) => {
      completed.push(event);
    },
    runFailed: (event) => {
      failed.push(event);
    },
    runProcessing: (event) => {
      processing.push(event);
    },
    runWaitingForSource: (event) => {
      waiting.push(event);
    },
    waiting
  };
}

function chatSource(id: string): SourceRef {
  return {
    _model: 'telegram.chat',
    id
  };
}

function failingArtifactStore(): Store {
  const store = createMemoryStore();
  return {
    ...store,
    upsertArtifacts() {
      throw new Error('artifact store failed');
    }
  };
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
