import { createLogger, logError } from '@agentg/framework';

import type { Database } from '../database/client.js';
import {
  listHistoryChats,
  readHistoryLiveBoundary,
  type HistoryChat
} from '../storage/historyCoverageStorage.js';
import type { GetMessagesInput, GetMessagesOutput } from '../procedures/get-messages/contract.js';
import type { HistoryGapRestoreRuleSet as RuleSet } from '../../policies/policies.js';
import { planRequest, selectDecision } from './planner.js';

type GetMessages = (input: GetMessagesInput) => Promise<GetMessagesOutput>;

type Logger = {
  error(payload: Record<string, unknown>, message: string): void;
  info(payload: Record<string, unknown>, message: string): void;
};

type Store = {
  listChats: () => Promise<HistoryChat[]>;
  readLiveBoundary: (chatId: string) => Promise<Date | null>;
};

export type RestoreService = {
  restore: () => Promise<RestoreResult>;
};

export type RestoreResult = {
  failedRequests: number;
  requestedChats: number;
  skippedChats: number;
  status: 'failed' | 'ready';
  totalChats: number;
};

export function createRestoreService(input: {
  database: Database;
  getMessages: GetMessages;
  getRules: () => RuleSet;
}): RestoreService {
  const logger = createLogger('telegram');
  const store: Store = {
    listChats: () => listHistoryChats(input.database),
    readLiveBoundary: (chatId) => readHistoryLiveBoundary(input.database, chatId)
  };

  return {
    restore() {
      return runRestore({
        getMessages: input.getMessages,
        getRules: input.getRules,
        logger,
        store
      });
    }
  };
}

export async function runRestore(input: {
  getMessages: GetMessages;
  getRules: () => RuleSet;
  logger?: Logger;
  store: Store;
}): Promise<RestoreResult> {
  const rules = input.getRules();
  const chats = await input.store.listChats();
  const counts = {
    failedRequests: 0,
    requestedChats: 0,
    skippedChats: 0
  };
  const skipReasons: Record<string, number> = {};

  for (const chat of chats) {
    const decision = selectDecision(rules, chat);
    const liveBoundary =
      typeof decision === 'string' || decision.kind === 'disabled'
        ? null
        : await input.store.readLiveBoundary(chat.chatId);
    const plan = planRequest({
      chat,
      decision,
      liveBoundary
    });

    if (plan.kind === 'skip') {
      counts.skippedChats += 1;
      skipReasons[plan.reason] = (skipReasons[plan.reason] ?? 0) + 1;
      continue;
    }

    counts.requestedChats += 1;
    try {
      await input.getMessages(plan.input);
    } catch (error) {
      counts.failedRequests += 1;
      input.logger?.error(
        {
          chatId: chat.chatId,
          event: 'telegram.history_gap_restore_request_failed',
          reason: requestFailureReason(error),
          ...logError(error)
        },
        'telegram history gap restore request failed'
      );
    }
  }

  const result: RestoreResult = {
    ...counts,
    status: counts.failedRequests === 0 ? 'ready' : 'failed',
    totalChats: chats.length
  };
  input.logger?.info(
    {
      event: 'telegram.history_gap_restore_finished',
      failedRequests: result.failedRequests,
      hasAllRule: rules.all !== undefined,
      policyChatIdRules: Object.keys(rules.chatIds).length,
      policyChatTypeRules: Object.keys(rules.chatTypes).length,
      requestedChats: result.requestedChats,
      skipReasons,
      skippedChats: result.skippedChats,
      status: result.status,
      totalChats: result.totalChats
    },
    'telegram history gap restore finished'
  );
  return result;
}

function requestFailureReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
