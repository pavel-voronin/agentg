import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./telemetry.js', () => ({
  recordArtifactsUpdated: vi.fn(),
  recordRunRequest: vi.fn(),
  recordStats: vi.fn(),
  timeRun: vi.fn((_work: () => Promise<unknown>) => _work()),
  timeStage: vi.fn((_stage: string, work: () => Promise<unknown>) => work()),
  timeWorker: vi.fn((_operation: string, work: () => Promise<unknown>) => work())
}));

import type { EventPublisher } from './events.js';
import type { ProcessingInput, ProcessingOutput, ProfileRunner } from './profiles/types.js';
import { createRuntime } from './runtime.js';
import type { ContentRef, LlmRunPayload, SourceRef } from './schema.js';
import type { SourceResolver, SourceSnapshot } from './sources/types.js';
import { createMemoryStore } from './store.js';
import * as telemetry from './telemetry.js';

describe('LLM runner runtime telemetry', () => {
  beforeEach(() => {
    vi.mocked(telemetry.recordArtifactsUpdated).mockReset();
    vi.mocked(telemetry.recordRunRequest).mockReset();
    vi.mocked(telemetry.recordStats).mockReset();
    vi.mocked(telemetry.timeRun).mockClear();
    vi.mocked(telemetry.timeStage).mockClear();
    vi.mocked(telemetry.timeWorker).mockClear();
  });

  it('records request, worker, stage, artifact, and state telemetry from a real store run', async () => {
    const runtime = createRuntime({
      events: eventRecorder(),
      profiles: profileRunner(),
      sources: sourceResolver(),
      store: createMemoryStore()
    });

    await expect(runtime.run(payload(), new Date('2026-01-01T00:00:00.000Z'))).resolves.toEqual({
      runId: 'run_1',
      status: 'accepted'
    });
    await expect(runtime.processQueuedRuns(new Date('2026-01-01T00:00:01.000Z'))).resolves.toEqual({
      processed: 1
    });

    expect(telemetry.recordRunRequest).toHaveBeenCalledWith({
      source: 'direct',
      status: 'created'
    });
    expect(telemetry.timeWorker).toHaveBeenCalledWith('process_queued', expect.any(Function));
    expect(telemetry.timeRun).toHaveBeenCalledWith(expect.any(Function));
    expect(telemetry.timeStage).toHaveBeenCalledWith('source_resolution', expect.any(Function));
    expect(telemetry.timeStage).toHaveBeenCalledWith('profile_processing', expect.any(Function));
    expect(telemetry.timeStage).toHaveBeenCalledWith('artifact_storage', expect.any(Function));
    expect(telemetry.recordArtifactsUpdated).toHaveBeenCalledWith(1);
    expect(telemetry.recordStats).toHaveBeenLastCalledWith({
      artifactCount: 1,
      oldestProcessableRunAgeSeconds: 0,
      processableRunCount: 0,
      runStatusCounts: [
        {
          count: 1,
          status: 'completed'
        }
      ]
    });

    const calls = JSON.stringify(vi.mocked(telemetry.recordStats).mock.calls);
    expect(calls).not.toContain('run_1');
    expect(calls).not.toContain('default');
    expect(calls).not.toContain('telegram.message');
  });

  it('records rejected request telemetry before source resolution', async () => {
    let sourceCalls = 0;
    const runtime = createRuntime({
      events: eventRecorder(),
      profiles: profileRunner({ profiles: [] }),
      sources: {
        resolve() {
          sourceCalls += 1;
          return Promise.resolve({
            snapshot: snapshot(),
            status: 'ready'
          });
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

    expect(sourceCalls).toBe(0);
    expect(telemetry.recordRunRequest).toHaveBeenCalledWith({
      source: 'direct',
      status: 'rejected'
    });
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

function chatSource(id: string): SourceRef {
  return {
    _model: 'telegram.chat',
    id
  };
}

function messageContent(id: string, sourceRef: SourceRef): ContentRef {
  return {
    _model: 'telegram.message',
    id,
    sourceRef
  };
}

function snapshot(): SourceSnapshot {
  const sourceRef = chatSource('10');
  return {
    contentRefs: [messageContent('10:100', sourceRef)],
    payload: {
      messages: [
        {
          text: 'signal'
        }
      ]
    },
    sourceRefs: [sourceRef]
  };
}

function sourceResolver(): SourceResolver {
  return {
    resolve: () =>
      Promise.resolve({
        snapshot: snapshot(),
        status: 'ready'
      })
  };
}

function profileRunner(
  input: {
    output?: ProcessingOutput | string | undefined;
    profiles?: readonly string[] | undefined;
  } = {}
): ProfileRunner {
  const profiles = new Set(input.profiles ?? ['default']);
  return {
    hasProfile: (profile) => profiles.has(profile),
    process(processingInput: ProcessingInput) {
      const output = input.output ?? 'summary';
      return Promise.resolve(
        typeof output === 'string'
          ? {
              body: output,
              payload: {
                profile: processingInput.profile
              }
            }
          : output
      );
    }
  };
}

function eventRecorder(): EventPublisher {
  return {
    artifactUpdated: () => undefined,
    runAccepted: () => undefined,
    runCompleted: () => undefined,
    runFailed: () => undefined,
    runProcessing: () => undefined,
    runWaitingForSource: () => undefined
  };
}
