import type { EventBus } from '@agentg/events/bus';
import type {
  $Function as TdlibFunction,
  Chat,
  Chats,
  Message,
  Messages,
  Ok,
  getChat as GetChatRequest,
  getChatHistory as GetChatHistoryRequest,
  getChatMessageByDate as GetChatMessageByDateRequest,
  getChats as GetChatsRequest,
  loadChats as LoadChatsRequest
} from 'tdlib-types';

import { invokeTdlibWithEvents, type TdlibInvokeOptions } from './telegramOperationEvents.js';
import type { TelegramProcedureContext } from './telegram-procedure-runtime/context.js';

async function invokeTdlib(
  eventBus: EventBus,
  client: TelegramProcedureContext['client'],
  request: TdlibFunction,
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

export async function getChat(
  context: Pick<TelegramProcedureContext, 'client' | 'eventBus'>,
  request: GetChatRequest,
  options: TdlibInvokeOptions = {}
): Promise<Chat> {
  return invokeTdlib(context.eventBus, context.client, request, options) as Promise<Chat>;
}

export async function getChats(
  context: Pick<TelegramProcedureContext, 'client' | 'eventBus'>,
  request: GetChatsRequest,
  options: TdlibInvokeOptions = {}
): Promise<Chats> {
  return invokeTdlib(context.eventBus, context.client, request, options) as Promise<Chats>;
}

export async function getChatHistory(
  context: Pick<TelegramProcedureContext, 'client' | 'eventBus'>,
  request: GetChatHistoryRequest,
  options: TdlibInvokeOptions = {}
): Promise<Messages> {
  return invokeTdlib(context.eventBus, context.client, request, options) as Promise<Messages>;
}

export async function getChatMessageByDate(
  context: Pick<TelegramProcedureContext, 'client' | 'eventBus'>,
  request: GetChatMessageByDateRequest,
  options: TdlibInvokeOptions = {}
): Promise<Message> {
  return invokeTdlib(context.eventBus, context.client, request, options) as Promise<Message>;
}

export async function loadChats(
  context: Pick<TelegramProcedureContext, 'client' | 'eventBus'>,
  request: LoadChatsRequest,
  options: TdlibInvokeOptions = {}
): Promise<Ok> {
  return invokeTdlib(context.eventBus, context.client, request, options) as Promise<Ok>;
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
