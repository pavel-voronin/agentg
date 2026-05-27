import type { EventBus } from '@agentg/events/bus';
import type {
  $Function as TdlibFunction,
  Chat,
  ChatList$Input,
  Chats,
  Message,
  Messages,
  Ok
} from 'tdlib-types';

import {
  invokeTdlibWithEvents,
  type TdlibInvokeOptions,
  type TdlibInvoker
} from './telegramOperationEvents.js';

type TelegramTdlibOperationDeps = {
  client: TdlibInvoker;
  eventBus: EventBus;
};

export function createTelegramTdlibOperations(deps: TelegramTdlibOperationDeps) {
  return {
    getChat(
      input: {
        chatId: number;
      },
      options?: TdlibInvokeOptions
    ): Promise<Chat> {
      return invokeTdlib(deps, { _: 'getChat', chat_id: input.chatId }, options) as Promise<Chat>;
    },
    getChatHistory(
      input: {
        chatId: number;
        fromMessageId: number;
        limit: number;
        offset: number;
        onlyLocal: boolean;
      },
      options?: TdlibInvokeOptions
    ): Promise<Messages> {
      return invokeTdlib(
        deps,
        {
          _: 'getChatHistory',
          chat_id: input.chatId,
          from_message_id: input.fromMessageId,
          limit: input.limit,
          offset: input.offset,
          only_local: input.onlyLocal
        },
        options
      ) as Promise<Messages>;
    },
    getChatMessageByDate(
      input: {
        chatId: number;
        date: number;
      },
      options?: TdlibInvokeOptions
    ): Promise<Message> {
      return invokeTdlib(
        deps,
        {
          _: 'getChatMessageByDate',
          chat_id: input.chatId,
          date: input.date
        },
        options
      ) as Promise<Message>;
    },
    getChats(
      input: {
        chatList: ChatList$Input;
        limit: number;
      },
      options?: TdlibInvokeOptions
    ): Promise<Chats> {
      return invokeTdlib(
        deps,
        { _: 'getChats', chat_list: input.chatList, limit: input.limit },
        options
      ) as Promise<Chats>;
    },
    loadChats(
      input: {
        chatList: ChatList$Input;
        limit: number;
      },
      options?: TdlibInvokeOptions
    ): Promise<Ok> {
      return invokeTdlib(
        deps,
        { _: 'loadChats', chat_list: input.chatList, limit: input.limit },
        options
      ) as Promise<Ok>;
    }
  };
}

async function invokeTdlib(
  deps: TelegramTdlibOperationDeps,
  request: TdlibFunction,
  options: TdlibInvokeOptions = {}
): Promise<unknown> {
  for (;;) {
    try {
      return await invokeTdlibWithEvents(deps.eventBus, deps.client, request, {
        ...options
      });
    } catch (error) {
      const floodWaitSeconds = parseFloodWaitSeconds(error);
      if (floodWaitSeconds === undefined) {
        throw error;
      }

      console.warn(
        JSON.stringify({
          event: 'telegram.flood_wait',
          request: request._,
          seconds: floodWaitSeconds
        })
      );
      await delay((floodWaitSeconds + 1) * 1000);
    }
  }
}

function parseFloodWaitSeconds(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = /FLOOD(?:_PREMIUM)?_WAIT_(\d+)/.exec(message);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export type TelegramTdlibOperations = ReturnType<typeof createTelegramTdlibOperations>;
