import { performance } from 'node:perf_hooks';

import type { Dataset, DatasetRow } from '@agentg/data';
import { createLogger, logError, toJsonValue, type JsonValue } from '@agentg/framework';

import type { EventPublisher } from './events.js';
import type { ProcessingOutput, ProfileRunner } from './profiles/types.js';
import type { RunRecord } from './runs/types.js';
import type { LlmRunActionRequest, LlmRunActionResult, LlmRunResult } from './schema.js';
import { inputMetadata, type Store } from './store.js';
import {
  recordCurrentStats,
  recordRowsProcessed,
  recordRunDuration,
  recordRunStarted,
  timeProviderCall
} from './telemetry.js';

const logger = createLogger('llm-runner');
const defaultClaimStaleMs = 60_000;

export type Runtime = {
  getRunResult(input: { runId: string }): Promise<LlmRunResult | null>;
  recoverActiveRuns(now?: Date): Promise<{
    failed: number;
    started: number;
  }>;
  run(input: LlmRunActionRequest, now?: Date): Promise<LlmRunActionResult>;
};

export function createRuntime(input: {
  claimStaleMs?: number | undefined;
  events: EventPublisher;
  profiles: ProfileRunner;
  store: Store;
}): Runtime {
  const activeRuns = new Set<string>();
  const claimStaleMs = Math.max(1, input.claimStaleMs ?? defaultClaimStaleMs);
  return {
    async getRunResult(readInput) {
      const run = await input.store.getRun(readInput.runId);
      if (run === null) {
        return null;
      }
      if (run.status === 'completed') {
        if (run.outputDataset === undefined) {
          throw new Error(`Completed LLM run has no output dataset: ${run.runId}`);
        }
        return {
          dataset: run.outputDataset,
          runId: run.runId,
          status: 'completed'
        };
      }
      if (run.status === 'failed') {
        return {
          error: {
            code: run.failureCode ?? 'llm_run_failed',
            message: run.failureMessage ?? 'LLM run failed'
          },
          runId: run.runId,
          status: 'failed'
        };
      }
      return {
        runId: run.runId,
        status: run.status === 'accepted' ? 'accepted' : 'processing'
      };
    },
    async recoverActiveRuns(now = new Date()) {
      let failed = 0;
      let started = 0;
      for (const run of await input.store.listActiveRuns()) {
        if (activeRuns.has(run.runId)) {
          continue;
        }
        const claimed = await input.store.claimActiveRun({
          now,
          runId: run.runId,
          staleBefore: claimStaleBefore(now, claimStaleMs)
        });
        if (claimed === null) {
          continue;
        }
        if (!input.profiles.hasProfile(claimed.profile)) {
          await input.store.markFailed({
            code: 'unknown_profile',
            message: `LLM profile is not configured: ${claimed.profile}`,
            metadata: inputMetadata(
              claimed.inputDataset.rows.length,
              outputFormatFromMetadata(claimed)
            ),
            now,
            runId: claimed.runId
          });
          await recordCurrentStats(() => input.store.readStats());
          publishRunEvent(input.events, 'failed', claimed, 'unknown_profile');
          failed += 1;
          continue;
        }
        if (startProcessing(input, requestFromRun(claimed), claimed, activeRuns, claimStaleMs)) {
          started += 1;
        }
      }
      return { failed, started };
    },
    run(request, now = new Date()) {
      return runAction(input, request, now, activeRuns, claimStaleMs);
    }
  };
}

async function runAction(
  input: {
    events: EventPublisher;
    profiles: ProfileRunner;
    store: Store;
  },
  request: LlmRunActionRequest,
  now: Date,
  activeRuns: Set<string>,
  claimStaleMs: number
): Promise<LlmRunActionResult> {
  if (!input.profiles.hasProfile(request.with.profile)) {
    return rejected('unknown_profile', `LLM profile is not configured: ${request.with.profile}`);
  }

  const run = await input.store.createRun({
    inputDataset: request.input,
    inputMetadata: inputMetadata(request.input.rows.length, outputFormat(request)),
    nodeId: request.node.id,
    now,
    pipelineRunId: request.node.runId,
    profile: request.with.profile,
    prompt: request.with.prompt,
    status: 'accepted'
  });
  recordRunStarted(request.with.profile);
  await recordCurrentStats(() => input.store.readStats());
  publishRunEvent(input.events, 'accepted', run);
  const claimed = await input.store.claimActiveRun({
    now,
    runId: run.runId,
    staleBefore: claimStaleBefore(now, claimStaleMs)
  });
  if (claimed !== null) {
    startProcessing(input, request, claimed, activeRuns, claimStaleMs);
  }
  return {
    runId: run.runId,
    status: 'accepted'
  };
}

function startProcessing(
  input: {
    events: EventPublisher;
    profiles: ProfileRunner;
    store: Store;
  },
  request: LlmRunActionRequest,
  run: RunIdentity,
  activeRuns: Set<string>,
  claimStaleMs: number
): boolean {
  if (activeRuns.has(run.runId)) {
    return false;
  }
  activeRuns.add(run.runId);
  processActiveRun(input, request, run, activeRuns, claimStaleMs);
  return true;
}

function processActiveRun(
  input: {
    events: EventPublisher;
    profiles: ProfileRunner;
    store: Store;
  },
  request: LlmRunActionRequest,
  run: RunIdentity,
  activeRuns: Set<string>,
  claimStaleMs: number
): void {
  void processRun(input, request, run, claimStaleMs)
    .catch((error: unknown) => {
      logger.error(
        {
          event: 'llm_runner.background_processing_failed',
          runId: run.runId,
          ...logError(error)
        },
        'LLM background processing failed'
      );
    })
    .finally(() => {
      activeRuns.delete(run.runId);
    });
}

export function startRunRecoveryLoop(input: {
  intervalMs: number;
  runtime: Pick<Runtime, 'recoverActiveRuns'>;
}): () => Promise<undefined> {
  let active = true;
  let currentTick: Promise<unknown> | undefined;
  const tick = () => {
    if (!active || currentTick !== undefined) {
      return;
    }
    currentTick = recoverTick(input.runtime).finally(() => {
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

async function recoverTick(runtime: Pick<Runtime, 'recoverActiveRuns'>): Promise<undefined> {
  try {
    await runtime.recoverActiveRuns();
  } catch (error) {
    logger.error(
      {
        event: 'llm_runner.recovery_failed',
        ...logError(error)
      },
      'LLM run recovery failed'
    );
  }
  return undefined;
}

type RunIdentity = {
  nodeId: string;
  pipelineRunId: string;
  profile: string;
  runId: string;
};

async function processRun(
  input: {
    events: EventPublisher;
    profiles: ProfileRunner;
    store: Store;
  },
  request: LlmRunActionRequest,
  run: RunIdentity,
  claimStaleMs: number
): Promise<void> {
  const startedAt = performance.now();
  const stopLeaseRefresh = startLeaseRefresh(input.store, run.runId, claimStaleMs);
  try {
    await recordCurrentStats(() => input.store.readStats());
    publishRunEvent(input.events, 'processing', run);

    const dataset = await processRows(input.profiles, request);
    await input.store.markCompleted({
      dataset,
      metadata: toJsonValue({
        rowCount: dataset.rows.length
      }),
      now: new Date(),
      runId: run.runId
    });
    recordRowsProcessed(run.profile, 'completed', dataset.rows.length);
    recordRunDuration(run.profile, 'completed', startedAt);
    await recordCurrentStats(() => input.store.readStats());
    publishRunEvent(input.events, 'completed', run);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await input.store.markFailed({
      code: 'provider_failed',
      message,
      metadata: toJsonValue({
        rowCount: request.input.rows.length
      }),
      now: new Date(),
      runId: run.runId
    });
    recordRunDuration(run.profile, 'failed', startedAt, error);
    await recordCurrentStats(() => input.store.readStats());
    publishRunEvent(input.events, 'failed', run, 'provider_failed');
  } finally {
    stopLeaseRefresh();
  }
}

function startLeaseRefresh(store: Store, runId: string, claimStaleMs: number): () => void {
  const refreshMs = Math.max(1, Math.floor(claimStaleMs / 3));
  const timer = setInterval(() => {
    void store
      .refreshProcessingRun({
        now: new Date(),
        runId
      })
      .catch((error: unknown) => {
        logger.warn(
          {
            event: 'llm_runner.lease_refresh_failed',
            runId,
            ...logError(error)
          },
          'LLM run lease refresh failed'
        );
      });
  }, refreshMs);
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}

function claimStaleBefore(now: Date, claimStaleMs: number): Date {
  return new Date(now.getTime() - claimStaleMs);
}

function requestFromRun(run: RunRecord): LlmRunActionRequest {
  const format = outputFormatFromMetadata(run);
  return {
    input: run.inputDataset,
    node: {
      id: run.nodeId,
      runId: run.pipelineRunId
    },
    with: {
      ...(format === 'text' ? {} : { output: { format } }),
      profile: run.profile,
      prompt: run.prompt
    }
  };
}

function outputFormatFromMetadata(run: RunRecord): 'json' | 'text' {
  const metadata = run.inputMetadata;
  if (
    metadata !== null &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    (metadata.outputFormat === 'json' || metadata.outputFormat === 'text')
  ) {
    return metadata.outputFormat;
  }
  return 'text';
}

function publishRunEvent(
  events: EventPublisher,
  status: 'accepted' | 'completed' | 'failed' | 'processing',
  run: {
    nodeId: string;
    pipelineRunId: string;
    profile: string;
    runId: string;
  },
  failureCode?: string
): void {
  try {
    const event = {
      ...(failureCode === undefined ? {} : { failureCode }),
      nodeId: run.nodeId,
      pipelineRunId: run.pipelineRunId,
      profile: run.profile,
      runId: run.runId,
      status
    };
    if (status === 'accepted') {
      events.runAccepted(event);
      return;
    }
    if (status === 'completed') {
      events.runCompleted(event);
      return;
    }
    if (status === 'failed') {
      events.runFailed(event);
      return;
    }
    events.runProcessing(event);
  } catch (error) {
    logger.warn(
      {
        event: 'llm_runner.event_publish_failed',
        eventStatus: status,
        runId: run.runId,
        ...logError(error)
      },
      'LLM run event publication failed'
    );
  }
}

async function processRows(
  profiles: ProfileRunner,
  request: LlmRunActionRequest
): Promise<Dataset> {
  if (request.input.rows.length === 0) {
    return {
      rows: []
    };
  }
  const format = outputFormat(request);
  const rows: DatasetRow[] = [];
  for (const row of request.input.rows) {
    const output = await timeProviderCall(request.with.profile, format, () =>
      profiles.process({
        profile: request.with.profile,
        prompt: request.with.prompt,
        row
      })
    );
    rows.push(outputRow(row, output, format));
  }
  return {
    rows
  };
}

function outputRow(row: DatasetRow, output: ProcessingOutput, format: 'json' | 'text'): DatasetRow {
  return {
    lineage: row.lineage,
    refs: row.refs,
    value: format === 'json' ? parseJsonOutput(output.text) : output.text
  };
}

function outputFormat(request: LlmRunActionRequest): 'json' | 'text' {
  return request.with.output?.format ?? 'text';
}

function parseJsonOutput(text: string): JsonValue {
  try {
    return toJsonValue(JSON.parse(text) as unknown);
  } catch (error) {
    throw new Error(
      `LLM output is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

function rejected(
  code: string,
  message: string
): Extract<LlmRunActionResult, { status: 'rejected' }> {
  return {
    error: {
      code,
      message
    },
    status: 'rejected'
  };
}
