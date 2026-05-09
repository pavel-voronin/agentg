import { mutation } from '@agentg/rpc/surface';

import { asTdObject, normalizeHistoricalMessage } from '../../normalize.js';
import {
  telegramHistoryFetchPageInputSchema,
  telegramHistoryFetchPageResultSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { persistTelegramUpdate } from '../../store.js';
import {
  getLastMessageNoLaterThan,
  invokeTdlib,
  isBeforeInterval,
  isTdObject,
  oldestMessageDate,
  oldestMessageIdOlderThan,
  optionalTelegramMessageId,
  parseLimit,
  parseTelegramChatId,
  requireDate,
  tdMessageDate,
  tdMessageId
} from './support.js';

export const fetchPage = mutation((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramHistoryFetchPageInputSchema)
    .output(telegramHistoryFetchPageResultSchema)
    .mutation(async ({ input }) => {
      const chatId = parseTelegramChatId(input.chatId);
      const startAt = requireDate(input.startAt, 'telegram.history.fetch_page requires startAt');
      const endAt = requireDate(input.endAt, 'telegram.history.fetch_page requires endAt');
      const limit = parseLimit(input.limit, 100, 100);
      let cursorMessageId = optionalTelegramMessageId(input.cursorMessageId);

      if (cursorMessageId === undefined) {
        const anchor = await getLastMessageNoLaterThan(
          runtime.client,
          runtime.eventBus,
          chatId,
          endAt,
          {
            priority: 'p4'
          }
        );
        const anchorDate = tdMessageDate(anchor);
        const anchorMessageId = tdMessageId(anchor);

        if (anchor === undefined || anchorMessageId === undefined) {
          return {
            fetchedMessages: 0,
            kind: 'no_messages_before_end',
            storedMessages: 0
          };
        }

        if (anchorDate !== undefined && anchorDate < startAt) {
          return {
            anchorMessageDate: anchorDate.toISOString(),
            fetchedMessages: 0,
            kind: 'anchor_before_start',
            storedMessages: 0
          };
        }

        cursorMessageId = anchorMessageId;
      }

      const history = asTdObject(
        await invokeTdlib(
          runtime.eventBus,
          runtime.client,
          {
            _: 'getChatHistory',
            chat_id: chatId,
            from_message_id: cursorMessageId,
            limit,
            offset: 0,
            only_local: false
          },
          {
            priority: 'p4'
          }
        )
      );
      const messages = Array.isArray(history?.messages) ? history.messages.map(asTdObject) : [];
      const concreteMessages = messages.filter(isTdObject);

      if (concreteMessages.length === 0) {
        return {
          fetchedMessages: 0,
          kind: 'no_messages_before_end',
          storedMessages: 0
        };
      }

      let storedMessages = 0;
      for (const message of concreteMessages) {
        const messageDate = tdMessageDate(message);
        if (messageDate === undefined || messageDate < startAt || messageDate >= endAt) {
          continue;
        }

        const normalized = normalizeHistoricalMessage(message);
        if (normalized === undefined) {
          continue;
        }

        const result = await persistTelegramUpdate(runtime.database, normalized);
        runtime.fileIndexer.enqueue(normalized, 'history_fetch');
        if (result.message) {
          storedMessages += 1;
        }
      }

      const nextCursorMessageId = oldestMessageIdOlderThan(concreteMessages, cursorMessageId);
      const oldestFetchedMessageDate = oldestMessageDate(concreteMessages);

      return {
        crossedStart: concreteMessages.some((message) => isBeforeInterval(message, startAt)),
        fetchedMessages: concreteMessages.length,
        kind: 'page',
        ...(nextCursorMessageId === undefined ? {} : { nextCursorMessageId }),
        ...(oldestFetchedMessageDate === undefined
          ? {}
          : { oldestFetchedMessageDate: oldestFetchedMessageDate.toISOString() }),
        reachedBeginning: nextCursorMessageId === undefined,
        storedMessages
      };
    })
);
