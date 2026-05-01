import type { EventBus } from '@agentg/shared/events/bus';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/shared/events/envelope';
import {
  TELEGRAM_HISTORY_FETCH_PAGE_REQUESTED,
  TELEGRAM_HISTORY_LIST_CHATS_REQUESTED,
  type TelegramHistoryChat,
  type TelegramHistoryFetchPageRequest,
  type TelegramHistoryFetchPageResult,
  type TelegramHistoryListChatsRequest,
  type TelegramHistoryListChatsResult
} from '@agentg/shared/events/telegram-history';
import type { JsonObject } from '@agentg/shared/json';

export type TelegramHistoryClient = {
  fetchPage(request: TelegramHistoryFetchPageRequest): Promise<TelegramHistoryFetchPageResult>;
  listChats(request: TelegramHistoryListChatsRequest): Promise<TelegramHistoryChat[]>;
};

const TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS = 30000;

export function createNatsTelegramHistoryClient(eventBus: EventBus): TelegramHistoryClient {
  return {
    async fetchPage(request) {
      const response = await requestTelegram(eventBus, TELEGRAM_HISTORY_FETCH_PAGE_REQUESTED, {
        request
      });
      return parseFetchPageResult(response);
    },
    async listChats(request) {
      const response = await requestTelegram(eventBus, TELEGRAM_HISTORY_LIST_CHATS_REQUESTED, {
        request
      });
      const result = parseListChatsResult(response);
      return result.chats;
    }
  };
}

async function requestTelegram(
  eventBus: EventBus,
  type: string,
  data: JsonObject
): Promise<IntegrationEvent> {
  const response = await eventBus.request(
    createIntegrationEvent({
      data,
      source: 'history-sync',
      type
    }),
    {
      timeoutMs: TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
    }
  );
  const responseData = asRecord(response.data);
  if (typeof responseData?.error === 'string') {
    throw new Error(responseData.error);
  }

  return response;
}

function parseListChatsResult(event: IntegrationEvent): TelegramHistoryListChatsResult {
  const data = asRecord(event.data);
  const result = asRecord(data?.result);
  const chats = Array.isArray(result?.chats) ? result.chats.filter(isTelegramHistoryChat) : [];
  return { chats };
}

function parseFetchPageResult(event: IntegrationEvent): TelegramHistoryFetchPageResult {
  const data = asRecord(event.data);
  const result = asRecord(data?.result);
  if (result?.kind === 'no_messages_before_end') {
    return {
      fetchedMessages: 0,
      kind: 'no_messages_before_end',
      storedMessages: 0
    };
  }
  if (result?.kind === 'anchor_before_start') {
    const anchorMessageDate = requireString(
      result.anchorMessageDate,
      'telegram.history.fetch_page response requires anchorMessageDate'
    );
    return {
      anchorMessageDate,
      fetchedMessages: 0,
      kind: 'anchor_before_start',
      storedMessages: 0
    };
  }
  if (result?.kind === 'page') {
    const fetchedMessages = requireSafeInteger(
      result.fetchedMessages,
      'telegram.history.fetch_page response requires fetchedMessages'
    );
    const storedMessages = requireSafeInteger(
      result.storedMessages,
      'telegram.history.fetch_page response requires storedMessages'
    );
    const nextCursorMessageId = optionalSafeInteger(result.nextCursorMessageId);
    const oldestFetchedMessageDate = optionalString(result.oldestFetchedMessageDate);
    return {
      crossedStart: result.crossedStart === true,
      fetchedMessages,
      kind: 'page',
      ...(nextCursorMessageId === undefined ? {} : { nextCursorMessageId }),
      ...(oldestFetchedMessageDate === undefined ? {} : { oldestFetchedMessageDate }),
      reachedBeginning: result.reachedBeginning === true,
      storedMessages
    };
  }

  throw new Error('Invalid telegram.history.fetch_page response');
}

function isTelegramHistoryChat(value: unknown): value is TelegramHistoryChat {
  const record = asRecord(value);
  return (
    typeof record?.id === 'string' &&
    typeof record.title === 'string' &&
    typeof record.type === 'string'
  );
}

function requireSafeInteger(value: unknown, message: string): number {
  const parsed = optionalSafeInteger(value);
  if (parsed === undefined) {
    throw new Error(message);
  }
  return parsed;
}

function optionalSafeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function requireString(value: unknown, message: string): string {
  const parsed = optionalString(value);
  if (parsed === undefined) {
    throw new Error(message);
  }
  return parsed;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
