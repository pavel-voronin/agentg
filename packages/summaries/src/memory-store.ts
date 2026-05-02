import type {
  SummaryInvalidation,
  SummaryReadResult,
  SummaryRequest,
  SummaryRequestResult,
  SummaryResult,
  SummaryRun,
  SummaryRunReadResult
} from './types.js';
import { createSummaryText, type SummaryRepository } from './store.js';

export function createInMemorySummaryRepository(): SummaryRepository {
  const runs = new Map<string, SummaryRun>();
  const summaries = new Map<string, SummaryResult>();
  const invalidations = new Map<string, SummaryInvalidation>();
  let runSequence = 0;
  let summarySequence = 0;

  return {
    clearInvalidation(chatId): Promise<void> {
      invalidations.delete(chatId);
      return Promise.resolve();
    },
    readChatSummary(chatId): Promise<SummaryReadResult> {
      return Promise.resolve({
        invalidation: invalidations.get(chatId) ?? null,
        summary: summaries.get(chatId) ?? null
      });
    },
    readRun(runId): Promise<SummaryRunReadResult> {
      return Promise.resolve({
        run: runs.get(runId) ?? null
      });
    },
    recordInvalidation(input): Promise<SummaryInvalidation> {
      const now = input.invalidatedAt.toISOString();
      const invalidation: SummaryInvalidation = {
        chatId: input.chatId,
        eventId: input.eventId ?? null,
        invalidatedAt: now,
        reason: input.reason,
        updatedAt: now
      };
      invalidations.set(input.chatId, invalidation);
      return Promise.resolve(invalidation);
    },
    requestSummary(input: SummaryRequest, now: Date): Promise<SummaryRequestResult> {
      runSequence += 1;
      const timestamp = now.toISOString();
      const run: SummaryRun = {
        chatId: input.chatId,
        completedAt: timestamp,
        error: null,
        failedAt: null,
        id: `sumrun_test_${String(runSequence)}`,
        reason: input.reason ?? null,
        requestedAt: timestamp,
        startedAt: timestamp,
        status: 'completed',
        updatedAt: timestamp
      };
      const existing = summaries.get(input.chatId);
      const summary: SummaryResult = {
        chatId: input.chatId,
        createdAt: existing?.createdAt ?? timestamp,
        id: existing?.id ?? ++summarySequence,
        runId: run.id,
        sourceReferences: input.sourceMessages,
        summary: createSummaryText(input, now),
        updatedAt: timestamp
      };

      runs.set(run.id, run);
      summaries.set(input.chatId, summary);
      invalidations.delete(input.chatId);

      return Promise.resolve({ run, summary });
    }
  };
}
