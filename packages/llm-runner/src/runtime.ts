import { createLogger, logError } from '@agentg/framework';

import { artifactView } from './artifacts/types.js';
import type { EventPublisher } from './events.js';
import type { ProcessingOutput, ProfileRunner } from './profiles/types.js';
import type {
  GetCurrentArtifactInput,
  ListArtifactsInput,
  LlmRunOutput,
  LlmRunPayload,
  TriggerProvenance
} from './schema.js';
import type { RunRecord } from './runs/types.js';
import type { SourceResolver, SourceResolution } from './sources/types.js';
import type { Store } from './store.js';

const logger = createLogger('llm-runner');
const processLimit = 10;

export type Runtime = {
  getCurrentArtifact(input: GetCurrentArtifactInput): Promise<{
    artifact: ReturnType<typeof artifactView> | null;
  }>;
  listArtifacts(input: ListArtifactsInput): Promise<{
    artifacts: ReturnType<typeof artifactView>[];
  }>;
  processQueuedRuns(now?: Date): Promise<{ processed: number }>;
  run(input: LlmRunPayload, now?: Date): Promise<LlmRunOutput>;
  runTriggered(
    input: {
      payload: LlmRunPayload;
      provenance: TriggerProvenance;
    },
    now?: Date
  ): Promise<LlmRunOutput>;
};

export function createRuntime(input: {
  events: EventPublisher;
  profiles: ProfileRunner;
  sources: SourceResolver;
  store: Store;
}): Runtime {
  let queue = Promise.resolve();

  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.catch(() => undefined).then(operation);
    queue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  return {
    async getCurrentArtifact(readInput) {
      const artifact = await input.store.getCurrentArtifact(readInput);
      return {
        artifact: artifact === null ? null : artifactView(artifact)
      };
    },
    async listArtifacts(readInput) {
      return {
        artifacts: (await input.store.listArtifacts(readInput)).map(artifactView)
      };
    },
    processQueuedRuns(now = new Date()) {
      return serialize(() => processQueuedRuns(input, now));
    },
    run(payload, now = new Date()) {
      return serialize(() =>
        acceptRun(input, {
          now,
          payload
        })
      );
    },
    runTriggered(triggered, now = new Date()) {
      return serialize(() =>
        acceptRun(input, {
          deduplicationKey: triggered.provenance.occurrence.idempotencyKey,
          now,
          payload: triggered.payload,
          trigger: triggered.provenance
        })
      );
    }
  };
}

export function startRuntimeLoop(input: {
  intervalMs: number;
  runtime: Runtime;
}): () => Promise<undefined> {
  let active = true;
  let currentTick: Promise<undefined> | undefined;
  const tick = () => {
    if (!active || currentTick !== undefined) {
      return;
    }
    currentTick = runTick(input.runtime).finally(() => {
      currentTick = undefined;
    });
  };

  tick();
  const timer = setInterval(() => {
    tick();
  }, input.intervalMs);
  timer.unref();

  return async () => {
    active = false;
    clearInterval(timer);
    await currentTick;
    return undefined;
  };
}

async function runTick(runtime: Runtime): Promise<undefined> {
  try {
    await runtime.processQueuedRuns();
  } catch (error) {
    logger.error(
      {
        event: 'llm_runner.worker_failed',
        ...logError(error)
      },
      'llm runner worker failed'
    );
  }
  return undefined;
}

async function acceptRun(
  input: {
    events: EventPublisher;
    profiles: ProfileRunner;
    store: Store;
  },
  runInput: {
    deduplicationKey?: string | undefined;
    now: Date;
    payload: LlmRunPayload;
    trigger?: TriggerProvenance | undefined;
  }
): Promise<LlmRunOutput> {
  if (!input.profiles.hasProfile(runInput.payload.profile)) {
    return {
      error: {
        code: 'unknown_profile',
        message: `LLM profile is not configured: ${runInput.payload.profile}`
      },
      status: 'rejected'
    };
  }

  const result = await input.store.createRun(runInput);
  if (result.created) {
    input.events.runAccepted(runEvent(result.run));
  }

  return {
    runId: result.run.runId,
    status: 'accepted'
  };
}

async function processQueuedRuns(
  input: {
    events: EventPublisher;
    profiles: ProfileRunner;
    sources: SourceResolver;
    store: Store;
  },
  now: Date
): Promise<{ processed: number }> {
  const runs = await input.store.listProcessableRuns({ limit: processLimit });
  for (const run of runs) {
    await processRun(input, run, now);
  }
  return {
    processed: runs.length
  };
}

async function processRun(
  input: {
    events: EventPublisher;
    profiles: ProfileRunner;
    sources: SourceResolver;
    store: Store;
  },
  run: RunRecord,
  now: Date
): Promise<void> {
  await input.store.markStatus({
    now,
    runId: run.runId,
    status: 'resolvingSource'
  });

  let resolution: SourceResolution;
  try {
    resolution = await input.sources.resolve({
      sourceSelector: run.payload.sourceSelector
    });
  } catch (error) {
    await failRun(input, run, now, 'source_resolution_failed', errorMessage(error));
    return;
  }
  if (resolution.status !== 'ready') {
    await recordUnreadyResolution(input, run, resolution, now);
    return;
  }

  try {
    if (resolution.snapshot.sourceRefs.length === 0) {
      await failRun(
        input,
        run,
        now,
        'source_refs_empty',
        'Source resolution returned no source refs'
      );
      return;
    }
    await input.store.recordSourceSnapshot({
      now,
      runId: run.runId,
      snapshot: resolution.snapshot
    });
    if (resolution.snapshot.contentRefs.length === 0) {
      await input.store.markStatus({
        now,
        runId: run.runId,
        status: 'completed'
      });
      input.events.runCompleted(
        runEvent(run, {
          contentRefs: resolution.snapshot.contentRefs,
          sourceRefs: resolution.snapshot.sourceRefs
        })
      );
      return;
    }
    await input.store.markStatus({
      now,
      runId: run.runId,
      status: 'processing'
    });
    input.events.runProcessing(
      runEvent(run, {
        contentRefs: resolution.snapshot.contentRefs,
        sourceRefs: resolution.snapshot.sourceRefs
      })
    );
    const output = requireProcessingOutput(
      await input.profiles.process({
        artifactKey: run.artifactKey,
        contentRefs: resolution.snapshot.contentRefs,
        instructions: run.payload.instructions,
        payload: resolution.snapshot.payload,
        profile: run.profile,
        sourceRefs: resolution.snapshot.sourceRefs
      })
    );
    await input.store.markStatus({
      now,
      runId: run.runId,
      status: 'storingArtifact'
    });
    const artifacts = await input.store.upsertArtifacts({
      now,
      output,
      run,
      snapshot: resolution.snapshot
    });
    await input.store.markStatus({
      now,
      runId: run.runId,
      status: 'completed'
    });
    for (const artifact of artifacts) {
      input.events.artifactUpdated({
        artifactId: artifact.artifactId,
        artifactKey: artifact.artifactKey,
        contentRefs: artifact.contentRefs,
        runId: artifact.runId,
        sourceRefs: artifact.sourceRefs,
        trigger: run.trigger
      });
    }
    input.events.runCompleted(
      runEvent(run, {
        contentRefs: resolution.snapshot.contentRefs,
        sourceRefs: resolution.snapshot.sourceRefs
      })
    );
  } catch (error) {
    await failRun(input, run, now, 'processing_failed', errorMessage(error));
  }
}

async function recordUnreadyResolution(
  input: {
    events: EventPublisher;
    store: Store;
  },
  run: RunRecord,
  resolution: Exclude<SourceResolution, { status: 'ready' }>,
  now: Date
): Promise<void> {
  if (resolution.status === 'pending') {
    await input.store.markStatus({
      now,
      runId: run.runId,
      status: 'waitingForSource'
    });
    input.events.runWaitingForSource(
      runEvent(run, {
        contentRefs: resolution.contentRefs,
        sourceRefs: resolution.sourceRefs
      })
    );
    return;
  }

  await failRun(input, run, now, resolution.error.code, resolution.error.message);
}

async function failRun(
  input: {
    events: EventPublisher;
    store: Store;
  },
  run: RunRecord,
  now: Date,
  code: string,
  message: string
): Promise<void> {
  await input.store.markFailed({
    code,
    message,
    now,
    runId: run.runId
  });
  input.events.runFailed(
    runEvent(run, {
      failureCode: code
    })
  );
}

function runEvent(
  run: RunRecord,
  extra: {
    contentRefs?: RunEventRefs['contentRefs'] | undefined;
    failureCode?: string | undefined;
    sourceRefs?: RunEventRefs['sourceRefs'] | undefined;
  } = {}
) {
  return {
    artifactKey: run.artifactKey,
    contentRefs: extra.contentRefs,
    failureCode: extra.failureCode,
    runId: run.runId,
    sourceRefs: extra.sourceRefs,
    trigger: run.trigger
  };
}

type RunEventRefs = {
  contentRefs: NonNullable<Parameters<EventPublisher['runProcessing']>[0]['contentRefs']>;
  sourceRefs: NonNullable<Parameters<EventPublisher['runProcessing']>[0]['sourceRefs']>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function requireProcessingOutput(value: ProcessingOutput): ProcessingOutput {
  if (typeof value.body !== 'string') {
    throw new Error('LLM provider output body must be a string');
  }
  if (value.title !== undefined && typeof value.title !== 'string') {
    throw new Error('LLM provider output title must be a string');
  }
  return value;
}
