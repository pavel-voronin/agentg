import { rm } from 'node:fs/promises';

import { createLogger, logError, runWithRootTelemetryContext } from '@agentg/framework';

import type { FileSnapshot } from '../domain/models/fileSnapshot.js';
import { publishAssetOwnersAndQueue } from './events.js';
import type { FileSlotUpdate } from './extractor.js';
import { runFileGeneration } from './generation.js';
import { processMessageSlotMaterializationBatch } from './messageSlots.js';
import { markStoredMessageFileSlotsRecorded } from '../storage/messageSlotStorage.js';
import {
  deleteStoryFileSlots as deleteStorySlots,
  handleFileSnapshot,
  recordFileSlotUpdate,
  type FileSlotScope,
  type FileSlotUpdateOptions
} from './persistence.js';
import type { MediaDownloadPolicyCause } from './policy.js';
import { readFileQueueStats } from '../storage/fileReadStorage.js';
import { requestFileSlot } from './request.js';
import {
  DEFAULT_WORKER_FAILURE_BACKOFF_MS,
  DEFAULT_WORKER_FILE_DOWNLOAD_DEFER_MS,
  DEFAULT_WORKER_MAX_CONCURRENT_DOWNLOADS,
  DEFAULT_WORKER_MAX_FILES_PER_TICK,
  DEFAULT_WORKER_STALE_CHECK_MS,
  completedFileAssetFromTdlibFile,
  positiveInteger,
  type ActiveFileGeneration,
  type CompletedFileAsset,
  type FileDownloadBatchResult,
  type FileGenerationStartUpdate,
  type FileRequestResult,
  type FileSubsystemOptions
} from './runtime.js';
import { logWorkerError, processCompletedFileBatch, processQueuedFileBatch } from './queue.js';
import {
  recordQueueStatsTelemetry,
  recordWorkerBatchResult,
  recordWorkerWake,
  timeWorkerStage,
  type WorkerWakeReason
} from './telemetry.js';
import type { FileOwner } from './types.js';

const logger = createLogger('telegram');

export type FileSlotRecording = {
  options?: FileSlotUpdateOptions;
  scope?: FileSlotScope;
  update: FileSlotUpdate;
};

export type FileSubsystem = {
  getQueueStats(): ReturnType<typeof readFileQueueStats>;
  handleFileSnapshot(snapshot: FileSnapshot): Promise<void>;
  recordFileSlots(recording: FileSlotRecording, cause: MediaDownloadPolicyCause): Promise<void>;
  scheduleMessageSlotMaterialization(): void;
  startFileGeneration(update: FileGenerationStartUpdate): void;
  stopFileGeneration(generationId: number | string): Promise<void>;
  deleteStoryFileSlots(input: { posterChatId: string; storyId: number }): Promise<void>;
  requestFile(input: { owner: FileOwner; slotKey: string }): Promise<FileRequestResult>;
};

type FileSubsystemRuntime = {
  files: FileSubsystem;
  start(): Promise<() => undefined>;
};

export function useFiles(options: FileSubsystemOptions): FileSubsystemRuntime {
  const completedFiles = new Map<string, CompletedFileAsset>();
  const activeFileGenerations = new Map<string, ActiveFileGeneration>();
  const failureBackoffMs = options.failureBackoffMs ?? DEFAULT_WORKER_FAILURE_BACKOFF_MS;
  const fileDownloadDeferMs = options.fileDownloadDeferMs ?? DEFAULT_WORKER_FILE_DOWNLOAD_DEFER_MS;
  const maxConcurrentDownloads = positiveInteger(
    options.maxConcurrentDownloads,
    DEFAULT_WORKER_MAX_CONCURRENT_DOWNLOADS
  );
  const maxFilesPerTick = positiveInteger(
    options.maxFilesPerTick,
    DEFAULT_WORKER_MAX_FILES_PER_TICK
  );
  const staleCheckMs = positiveInteger(options.staleCheckMs, DEFAULT_WORKER_STALE_CHECK_MS);
  let closed = false;
  let pending = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timerDueAtMs: number | undefined;
  let queueSubscription: { unsubscribe(): void } | undefined;

  const schedule = (reason: WorkerWakeReason, delayMs = 0): void => {
    if (closed) {
      return;
    }
    if (running) {
      pending = true;
      return;
    }
    const normalizedDelayMs = Math.max(0, delayMs);
    const dueAtMs = Date.now() + normalizedDelayMs;
    if (timer !== undefined) {
      if (timerDueAtMs !== undefined && timerDueAtMs <= dueAtMs) {
        return;
      }
      clearTimeout(timer);
      timer = undefined;
      timerDueAtMs = undefined;
    }
    recordWorkerWake(reason);
    timerDueAtMs = dueAtMs;
    timer = setTimeout(() => {
      timer = undefined;
      timerDueAtMs = undefined;
      runWithRootTelemetryContext(runTick);
    }, normalizedDelayMs);
    timer.unref();
  };

  const runTick = (): void => {
    if (closed) {
      return;
    }
    if (running) {
      pending = true;
      return;
    }
    running = true;
    void tick().then(handleTickResult, handleTickError);
  };

  const handleTickResult = (result: FileDownloadBatchResult): void => {
    running = false;
    if (closed) {
      return;
    }
    if (pending) {
      pending = false;
      schedule('batch_continuation', 0);
      return;
    }
    if (result.immediateCount > 0) {
      schedule(
        'batch_continuation',
        result.failedCount > 0 && result.readyCount === 0 ? failureBackoffMs : 0
      );
      return;
    }
    if (result.delayedCount > 0) {
      schedule('file_download_defer', fileDownloadDeferMs);
      return;
    }
    if (result.watchdogCount > 0) {
      schedule('stale_watchdog', staleCheckMs);
    }
  };

  const handleTickError = (error: unknown): void => {
    running = false;
    logWorkerError(error);
    if (closed) {
      return;
    }
    if (pending) {
      pending = false;
      schedule('batch_continuation', 0);
      return;
    }
    schedule('failure_backoff', failureBackoffMs);
  };

  const tick = (): Promise<FileDownloadBatchResult> =>
    timeWorkerStage('tick', async () => {
      const messageSlots = await timeWorkerStage('materialize_message_slots', () =>
        processMessageSlotMaterializationBatch(options, maxFilesPerTick)
      );
      const canonicalized = await processCompletedFileBatch(
        options,
        completedFiles,
        maxFilesPerTick
      );
      recordWorkerBatchResult('completed', canonicalized);
      const queued = await processQueuedFileBatch(options, {
        maxConcurrentDownloads,
        maxFilesPerTick
      });
      return {
        delayedCount: canonicalized.delayedCount + queued.delayedCount,
        failedCount: canonicalized.failedCount + queued.failedCount,
        immediateCount:
          (messageSlots.hasMore ? 1 : 0) + canonicalized.immediateCount + queued.immediateCount,
        processedCount: canonicalized.processedCount + queued.processedCount,
        readyCount: canonicalized.readyCount + queued.readyCount,
        watchdogCount: canonicalized.watchdogCount + queued.watchdogCount
      };
    });

  function close(): undefined {
    closed = true;
    pending = false;
    completedFiles.clear();
    for (const generation of activeFileGenerations.values()) {
      generation.controller.abort();
    }
    activeFileGenerations.clear();
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    timerDueAtMs = undefined;
    queueSubscription?.unsubscribe();
    queueSubscription = undefined;
    return undefined;
  }

  async function recordFileSlotsAndWake(operation: Promise<boolean>): Promise<void> {
    if (await operation) {
      schedule('slot_enqueue', 0);
    }
  }

  const files: FileSubsystem = {
    getQueueStats() {
      return readFileQueueStats(options.database).then((stats) => {
        recordQueueStatsTelemetry(stats);
        return stats;
      });
    },
    async handleFileSnapshot(snapshot): Promise<void> {
      const changedAssets = await handleFileSnapshot(options.database, snapshot);
      const completedFile = completedFileAssetFromTdlibFile(snapshot);
      if (completedFile !== null) {
        for (const assetKey of changedAssets) {
          completedFiles.set(assetKey, {
            ...completedFile,
            assetKey
          });
        }
        if (changedAssets.length > 0) {
          schedule('update_file_completed', 0);
        }
      }
      await publishAssetOwnersAndQueue(options, changedAssets);
    },
    scheduleMessageSlotMaterialization(): void {
      schedule('slot_enqueue', 0);
    },
    startFileGeneration(update): void {
      const generationId = update.generationId;
      activeFileGenerations.get(generationId)?.controller.abort();

      const generation: ActiveFileGeneration = {
        controller: new AbortController(),
        destinationPath: update.destinationPath
      };
      activeFileGenerations.set(generationId, generation);

      void runFileGeneration(options, update, generation.controller.signal)
        .catch((error: unknown) => {
          if (generation.controller.signal.aborted) {
            return;
          }
          logger.error(
            {
              event: 'telegram.file_generation_unhandled_failure',
              generationId: update.generationId,
              ...logError(error)
            },
            'telegram file generation failed'
          );
        })
        .finally(() => {
          if (activeFileGenerations.get(generationId) === generation) {
            activeFileGenerations.delete(generationId);
          }
        });
    },
    async stopFileGeneration(generationId): Promise<void> {
      const active = activeFileGenerations.get(String(generationId));
      if (active === undefined) {
        return;
      }

      active.controller.abort();
      activeFileGenerations.delete(String(generationId));
      await rm(active.destinationPath, { force: true });
    },
    async recordFileSlots(recording, cause): Promise<void> {
      await recordFileSlotsAndWake(
        recordFileSlotUpdate(options, recording.update, cause, recording.scope, recording.options)
      );
      const message = recording.update.message ?? recording.update.contentUpdate;
      if (message?.content !== undefined) {
        await markStoredMessageFileSlotsRecorded(options.database, {
          chatId: message.chatId,
          content: message.content,
          messageId: message.messageId
        });
      }
    },
    async deleteStoryFileSlots(input): Promise<void> {
      await deleteStorySlots(options.database, input);
    },
    async requestFile(input): Promise<FileRequestResult> {
      const result = await requestFileSlot(options, input);
      if (result.decision.action === 'enqueue') {
        schedule('manual_enqueue', 0);
      }
      return result;
    }
  };

  return {
    files,
    start(): Promise<() => undefined> {
      queueSubscription = options.events.subscribe('telegram.files.queueChanged', (event) => {
        if (queueStatsHasQueuedFiles(event.data)) {
          schedule('queue_event', 0);
        }
      });
      void readFileQueueStats(options.database).then(recordQueueStatsTelemetry, logWorkerError);
      schedule('startup', 0);
      return Promise.resolve(close);
    }
  };
}

function queueStatsHasQueuedFiles(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'queuedCount' in value &&
    typeof value.queuedCount === 'number' &&
    value.queuedCount > 0
  );
}
