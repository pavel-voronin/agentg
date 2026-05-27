import type { EventBus } from '@agentg/events/bus';

import { invokeTdlibWithEvents, type TdlibInvokeOptions } from '../telegramOperationEvents.js';
import { telegramTdlibPriorities } from '../telegramTdlibPriority.js';
import {
  type TelegramWireChat,
  type TelegramWireChats,
  type TelegramWireMessage,
  type TelegramWireObject
} from '../telegramWire.js';
import type { TelegramProcedureHandlerContext } from '../telegram-procedure-runtime/context.js';

export type ChatListKind =
  | {
      kind: 'archive' | 'main';
    }
  | {
      folderId: number;
      kind: 'folder';
    };

export async function invokeTdlib(
  eventBus: EventBus,
  client: TelegramProcedureHandlerContext['client'],
  request: TelegramWireObject,
  options: TdlibInvokeOptions = {}
): Promise<unknown> {
  for (;;) {
    try {
      return await invokeTdlibWithEvents(eventBus, client, request, {
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

export async function getLastMessageNoLaterThan(
  context: Pick<TelegramProcedureHandlerContext, 'client' | 'eventBus'>,
  chatId: number,
  end: Date,
  options: TdlibInvokeOptions = {}
): Promise<TelegramWireMessage | undefined> {
  try {
    return (await invokeTdlib(
      context.eventBus,
      context.client,
      {
        _: 'getChatMessageByDate',
        chat_id: chatId,
        date: Math.floor((end.getTime() - 1) / 1000)
      },
      options
    )) as TelegramWireMessage;
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

export async function loadAllChats(
  context: Pick<TelegramProcedureHandlerContext, 'client' | 'eventBus'>,
  batchSize: number,
  folderIds: number[]
): Promise<void> {
  await loadAllChatsFromList(context, { kind: 'main' }, batchSize);
  await loadAllChatsFromList(context, { kind: 'archive' }, batchSize);
  for (const folderId of folderIds) {
    await loadAllChatsFromList(context, { folderId, kind: 'folder' }, batchSize);
  }
}

export async function getChatIds(
  context: Pick<TelegramProcedureHandlerContext, 'client' | 'eventBus'>,
  chatList: ChatListKind,
  limit: number
): Promise<number[]> {
  let chats: TelegramWireChats | undefined;
  try {
    chats = (await invokeTdlib(
      context.eventBus,
      context.client,
      {
        _: 'getChats',
        chat_list: toTdChatList(chatList),
        limit
      },
      { priority: telegramTdlibPriorities.maximum }
    )) as TelegramWireChats;
  } catch (error) {
    if (isOptionalChatListNotFound(chatList, error)) {
      return [];
    }

    throw error;
  }

  return chats.chat_ids;
}

export async function getChatOrUndefined(
  context: Pick<TelegramProcedureHandlerContext, 'client' | 'eventBus'>,
  chatId: number
): Promise<TelegramWireChat | undefined> {
  try {
    return (await invokeTdlib(
      context.eventBus,
      context.client,
      { _: 'getChat', chat_id: chatId },
      {
        priority: telegramTdlibPriorities.maximum
      }
    )) as TelegramWireChat;
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

export function isTdlibNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message) || message.includes('NOT_FOUND') || message.includes('Not Found');
}

async function loadAllChatsFromList(
  context: Pick<TelegramProcedureHandlerContext, 'client' | 'eventBus'>,
  chatList: ChatListKind,
  batchSize: number
): Promise<void> {
  for (;;) {
    try {
      await invokeTdlib(
        context.eventBus,
        context.client,
        {
          _: 'loadChats',
          chat_list: toTdChatList(chatList),
          limit: batchSize
        },
        { priority: telegramTdlibPriorities.maximum }
      );
    } catch (error) {
      if (isTdlibNotFound(error)) {
        return;
      }

      throw error;
    }
  }
}

function parseFloodWaitSeconds(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = /FLOOD(?:_PREMIUM)?_WAIT_(\d+)/.exec(message);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

function toTdChatList(chatList: ChatListKind): TelegramWireObject {
  switch (chatList.kind) {
    case 'main':
      return { _: 'chatListMain' };
    case 'archive':
      return { _: 'chatListArchive' };
    case 'folder':
      return { _: 'chatListFolder', chat_folder_id: chatList.folderId };
  }
}

function isOptionalChatListNotFound(chatList: ChatListKind, error: unknown): boolean {
  return chatList.kind !== 'main' && isTdlibNotFound(error);
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
