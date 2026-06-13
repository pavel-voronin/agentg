import { createLogger, logError, type EventBus } from '@agentg/framework';
import type { message as Message } from 'tdlib-types';

import type { Database } from '../database/client.js';
import type { FileSubsystem } from '../files/index.js';
import { orderHistoryIntervalsClosestToPresent } from '../history/coverage.js';
import type { HistoryInterval } from '../history/time.js';
import type { Operations } from '../tdlib/operations.js';
import { storeMessages } from '../store/message.js';
import { checkMessagesReadiness } from '../procedures/get-messages/readiness.js';
import type { GetMessagesInput } from '../procedures/get-messages/contract.js';
import { normalizeMessageOwner } from './owner.js';
import { writeOwnerCoverage } from './coverage.js';
import { fetchOwnerHistoryStep } from './tdlib.js';
import {
  claimNextHistoryJob,
  completeHistoryJob,
  deferHistoryJob,
  enqueueHistoryJob,
  failHistoryJob,
  readNextHistoryJobRunAt,
  readHistoryReconcilerStats,
  releaseHistoryJob,
  type EnqueueResult,
  type HistoryJob
} from './jobs.js';
import {
  errorType,
  recordCoverageIntervals,
  recordFailure,
  recordJobDuration,
  recordMessages,
  recordPage,
  recordStats,
  recordTransition,
  timeReconcilerSpan,
  timeReconcilerTick,
  type ErrorType,
  type Stage
} from './telemetry.js';

export type HistoryReconciler = {
  enqueue(input: GetMessagesInput & { requestId: string }): Promise<EnqueueResult>;
  getStats(): ReturnType<typeof readHistoryReconcilerStats>;
};

export type HistoryReconcilerRuntime = {
  reconciler: HistoryReconciler;
  start(): Promise<() => undefined>;
};

type Options = {
  database: Database;
  events: EventBus;
  files: FileSubsystem;
  lockTimeoutMs?: number | undefined;
  tdlib: Operations;
};

const QUEUE_CHANGED_EVENT = 'telegram.history.reconciler.queueChanged';
const DEFAULT_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_TRANSIENT_ATTEMPTS = 5;
const BASE_DEFER_MS = 30 * 1000;
const MAX_DEFER_MS = 15 * 60 * 1000;
const logger = createLogger('telegram');

export function useHistoryReconciler(options: Options): HistoryReconcilerRuntime {
  const lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  let closed = false;
  let running = false;
  let pending = false;
  let pendingDelayMs: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queueSubscription: { unsubscribe(): void } | undefined;

  const schedule = (delayMs = 0): void => {
    if (closed) {
      return;
    }
    if (running) {
      pending = true;
      pendingDelayMs = pendingDelayMs === undefined ? delayMs : Math.min(pendingDelayMs, delayMs);
      return;
    }
    if (timer !== undefined) {
      return;
    }
    timer = setTimeout(
      () => {
        timer = undefined;
        runTick();
      },
      Math.max(0, delayMs)
    );
    timer.unref();
  };

  const runTick = (): void => {
    if (closed || running) {
      pending = running;
      return;
    }
    running = true;
    void tick().then(handleTickResult, handleTickError);
  };

  const tick = async (): Promise<boolean> =>
    timeReconcilerTick(async () => {
      const job = await timeReconcilerSpan(
        'telegram.history.reconciler.claim',
        { stage: 'claim' },
        () => claimNextHistoryJob(options.database, { lockTimeoutMs })
      );
      if (job === null) {
        await recordCurrentStats();
        await scheduleNextActiveJob();
        return false;
      }

      await processJob(job);
      await recordCurrentStats();
      return true;
    });

  const handleTickResult = (processed: boolean): void => {
    running = false;
    if (closed) {
      return;
    }
    if (pending) {
      const delayMs = pendingDelayMs ?? 0;
      pending = false;
      pendingDelayMs = undefined;
      schedule(delayMs);
      return;
    }
    if (processed) {
      schedule(0);
    }
  };

  const handleTickError = (failure: unknown): void => {
    running = false;
    logger.error(
      {
        event: 'telegram.history_reconciler.unhandled_tick_failure',
        ...logError(failure)
      },
      'telegram history reconciler tick failed'
    );
    if (!closed) {
      schedule(1000);
    }
  };

  async function processJob(job: HistoryJob): Promise<void> {
    const startedAt = Date.now();
    const input: GetMessagesInput = {
      owner: job.owner,
      selector: job.selector
    };
    const ownerKind = normalizeMessageOwner(job.owner).kind;
    let stage: Stage = 'coverage_check';

    try {
      stage = 'coverage_check';
      const firstReadiness = await timeReconcilerSpan(
        'telegram.history.reconciler.coverage_check',
        { 'owner.kind': ownerKind, stage: 'coverage_check' },
        () => checkMessagesReadiness(options.database, input)
      );
      if (firstReadiness.ready) {
        recordCoverageIntervals('already_covered', 1);
        stage = 'publish';
        await completeAndPublish(job, 'skipped_covered', startedAt);
        return;
      }

      const interval = nextInterval(firstReadiness.missing);
      if (interval === undefined) {
        await releaseHistoryJob(options.database, job.requestId);
        publishQueueChanged();
        return;
      }

      stage = 'tdlib_fetch';
      const fetched = await timeReconcilerSpan(
        'telegram.history.reconciler.tdlib_fetch',
        { 'owner.kind': ownerKind, stage: 'tdlib_fetch' },
        () =>
          fetchOwnerHistoryStep({
            database: options.database,
            interval,
            owner: job.owner,
            selector: job.selector,
            tdlib: options.tdlib
          })
      );
      recordPage(fetched.fetchedMessages.length === 0 ? 'empty' : 'fetched');
      recordMessages('fetched', fetched.fetchedMessages.length);

      stage = 'persist';
      const storedMessages = await timeReconcilerSpan(
        'telegram.history.reconciler.persist',
        { 'owner.kind': ownerKind, stage: 'persist' },
        () => persistMessages(options.database, fetched.fetchedMessages)
      );
      if (storedMessages > 0) {
        options.files.scheduleMessageSlotMaterialization();
      }
      recordMessages('stored', storedMessages);

      const coverageInterval = fetched.coverageInterval;
      if (coverageInterval !== undefined) {
        stage = 'coverage_check';
        await timeReconcilerSpan(
          'telegram.history.reconciler.coverage_check',
          { 'owner.kind': ownerKind, stage: 'coverage_check' },
          () => writeOwnerCoverage(options.database, job.owner, [coverageInterval])
        );
        recordCoverageIntervals('written', 1);
      }

      stage = 'coverage_check';
      const secondReadiness = await timeReconcilerSpan(
        'telegram.history.reconciler.coverage_check',
        { 'owner.kind': ownerKind, stage: 'coverage_check' },
        () => checkMessagesReadiness(options.database, input)
      );
      if (secondReadiness.ready) {
        stage = 'publish';
        await completeAndPublish(job, 'completed', startedAt);
        return;
      }

      await releaseHistoryJob(options.database, job.requestId);
      publishQueueChanged();
    } catch (failure) {
      const type = errorType(failure, stage);
      if (shouldDefer(job, type)) {
        await defer(job, stage, type, failure);
        return;
      }
      await fail(job, stage, type, failure, startedAt);
    }
  }

  async function completeAndPublish(
    job: HistoryJob,
    transition: 'completed' | 'skipped_covered',
    startedAt: number
  ): Promise<void> {
    await timeReconcilerSpan(
      'telegram.history.reconciler.publish',
      { 'owner.kind': normalizeMessageOwner(job.owner).kind, stage: 'publish' },
      () => {
        options.events.publish('telegram.messages.ready', {
          owner: job.owner,
          requestId: job.requestId,
          selector: job.selector
        });
        return Promise.resolve();
      }
    );
    await completeHistoryJob(options.database, job.requestId);
    recordTransition(transition);
    recordJobDuration({
      ownerKind: normalizeMessageOwner(job.owner).kind,
      result: transition,
      seconds: secondsSince(startedAt)
    });
    logger.info(
      {
        event: 'telegram.history_reconciler.job_completed',
        ownerKey: job.ownerKey,
        requestId: job.requestId,
        transition
      },
      'telegram history reconciler job completed'
    );
    publishQueueChanged();
  }

  async function fail(
    job: HistoryJob,
    stage: Stage,
    type: ErrorType,
    failure: unknown,
    startedAt: number
  ): Promise<void> {
    recordFailure(stage, type);
    options.events.publish('telegram.messages.failed', {
      owner: job.owner,
      reason: type,
      requestId: job.requestId,
      selector: job.selector
    });
    await failHistoryJob(options.database, {
      reason: type,
      requestId: job.requestId
    });
    recordTransition('failed');
    recordJobDuration({
      errorType: type,
      ownerKind: normalizeMessageOwner(job.owner).kind,
      result: 'failed',
      seconds: secondsSince(startedAt)
    });
    logger.error(
      {
        event: 'telegram.history_reconciler.job_failed',
        ownerKey: job.ownerKey,
        reason: type,
        requestId: job.requestId,
        ...logError(failure)
      },
      'telegram history reconciler job failed'
    );
    publishQueueChanged();
  }

  async function defer(
    job: HistoryJob,
    stage: Stage,
    type: ErrorType,
    failure: unknown
  ): Promise<void> {
    const nextAttemptCount = job.attemptCount + 1;
    const delayMs = nextDeferDelayMs(nextAttemptCount);
    const nextRunAt = new Date(Date.now() + delayMs);
    await deferHistoryJob(options.database, {
      nextRunAt,
      requestId: job.requestId
    });
    recordFailure(stage, type);
    recordTransition('deferred');
    logger.warn(
      {
        attemptCount: nextAttemptCount,
        event: 'telegram.history_reconciler.job_deferred',
        nextRunAt: nextRunAt.toISOString(),
        ownerKey: job.ownerKey,
        reason: type,
        requestId: job.requestId,
        stage,
        ...logError(failure)
      },
      'telegram history reconciler job deferred'
    );
    schedule(delayMs);
  }

  async function scheduleNextActiveJob(): Promise<void> {
    const nextRunAt = await readNextHistoryJobRunAt(options.database);
    if (nextRunAt !== undefined) {
      schedule(nextRunAt.getTime() - Date.now());
    }
  }

  async function recordCurrentStats(): Promise<void> {
    const stats = await readHistoryReconcilerStats(options.database);
    recordStats(stats);
  }

  function publishQueueChanged(): void {
    try {
      options.events.publish(QUEUE_CHANGED_EVENT);
    } catch (failure) {
      logger.warn(
        {
          event: 'telegram.history_reconciler.queue_changed_publish_failed',
          ...logError(failure)
        },
        'telegram history reconciler queue change publish failed'
      );
    }
  }

  function close(): undefined {
    closed = true;
    pending = false;
    pendingDelayMs = undefined;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    queueSubscription?.unsubscribe();
    queueSubscription = undefined;
    return undefined;
  }

  const reconciler: HistoryReconciler = {
    async enqueue(input): Promise<EnqueueResult> {
      const result = await enqueueHistoryJob(options.database, input);
      if (result === 'pending_enqueued') {
        logger.info(
          {
            event: 'telegram.history_reconciler.request_accepted',
            ownerKey: normalizeMessageOwner(input.owner).key,
            requestId: input.requestId,
            selectorKind: input.selector.kind
          },
          'telegram history reconciler request accepted'
        );
        publishQueueChanged();
        schedule(0);
        return result;
      }
      logger.info(
        {
          event: 'telegram.history_reconciler.request_coalesced',
          ownerKey: normalizeMessageOwner(input.owner).key,
          requestId: input.requestId,
          selectorKind: input.selector.kind
        },
        'telegram history reconciler request coalesced'
      );
      return result;
    },
    getStats() {
      return readHistoryReconcilerStats(options.database);
    }
  };

  return {
    reconciler,
    async start(): Promise<() => undefined> {
      queueSubscription = options.events.subscribe(QUEUE_CHANGED_EVENT, () => {
        schedule(0);
      });
      await recordCurrentStats();
      schedule(0);
      return close;
    }
  };
}

async function persistMessages(database: Database, messages: Message[]): Promise<number> {
  if (messages.length === 0) {
    return 0;
  }

  return database.transaction((transaction) => storeMessages(transaction, messages));
}

function nextInterval(intervals: HistoryInterval[]): HistoryInterval | undefined {
  return orderHistoryIntervalsClosestToPresent(intervals)[0];
}

function secondsSince(startedAt: number): number {
  return Math.max(0, (Date.now() - startedAt) / 1000);
}

function shouldDefer(job: HistoryJob, type: ErrorType): boolean {
  return isTransientErrorType(type) && job.attemptCount < MAX_TRANSIENT_ATTEMPTS;
}

function isTransientErrorType(type: ErrorType): boolean {
  return (
    type === 'coverage_write_error' ||
    type === 'event_publish_error' ||
    type === 'storage_error' ||
    type === 'tdlib_error' ||
    type === 'tdlib_unavailable' ||
    type === 'timeout'
  );
}

function nextDeferDelayMs(attemptCount: number): number {
  const multiplier = 2 ** Math.max(0, attemptCount - 1);
  return Math.min(MAX_DEFER_MS, BASE_DEFER_MS * multiplier);
}
