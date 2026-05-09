import type { EventBus } from '@agentg/events/bus';

import type { TelegramDatabase as AppDatabase } from './database.js';
import type { NormalizedTelegramUpdate } from './normalize.js';
import type { TelegramMediaDownloadPolicyCause } from './telegram-file-policy.js';
import { syncTelegramFileSlots, type TelegramFileOwnerKey } from './telegram-file-store.js';
import {
  publishTelegramFileOwnerUpdated,
  publishTelegramFileQueueUpdated
} from './telegram-file-worker.js';

export type TelegramFileIndexer = {
  close(): void;
  enqueue(update: NormalizedTelegramUpdate, cause: TelegramMediaDownloadPolicyCause): void;
};

export type TelegramFileIndexerOptions = {
  database: AppDatabase;
  eventBus: EventBus;
  maxJobsPerTick?: number;
};

type TelegramFileIndexJob = {
  cause: TelegramMediaDownloadPolicyCause;
  update: NormalizedTelegramUpdate;
};

const DEFAULT_FILE_INDEX_JOBS_PER_TICK = 25;

export function startTelegramFileIndexer(options: TelegramFileIndexerOptions): TelegramFileIndexer {
  const maxJobsPerTick = positiveInteger(options.maxJobsPerTick, DEFAULT_FILE_INDEX_JOBS_PER_TICK);
  const queue: TelegramFileIndexJob[] = [];
  let closed = false;
  let scheduled = false;
  let running = false;

  const schedule = (): void => {
    if (closed || scheduled || running) {
      return;
    }
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      void drain().catch(logIndexingError);
    }, 0).unref();
  };

  const drain = async (): Promise<void> => {
    if (closed || running) {
      return;
    }
    running = true;
    try {
      const owners = new Map<string, TelegramFileOwnerKey>();
      let processed = 0;
      while (processed < maxJobsPerTick) {
        const job = queue.shift();
        if (job === undefined) {
          break;
        }
        const changedOwners = await syncTelegramFileSlots(options.database, job.update, job.cause);
        for (const owner of changedOwners) {
          owners.set(`${owner.ownerModel}:${owner.ownerId}`, owner);
        }
        processed += 1;
      }

      for (const owner of owners.values()) {
        await publishTelegramFileOwnerUpdated(options.database, options.eventBus, owner);
      }
      if (owners.size > 0) {
        await publishTelegramFileQueueUpdated(options.database, options.eventBus);
      }
    } finally {
      running = false;
      if (queue.length > 0) {
        schedule();
      }
    }
  };

  return {
    close(): void {
      closed = true;
      queue.splice(0);
    },
    enqueue(update: NormalizedTelegramUpdate, cause: TelegramMediaDownloadPolicyCause): void {
      if (closed) {
        return;
      }
      queue.push({ cause, update });
      schedule();
    }
  };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function logIndexingError(error: unknown): void {
  console.warn(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'telegram.file_indexer_failed'
    })
  );
}
