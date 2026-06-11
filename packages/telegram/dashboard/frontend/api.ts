import { useDashboardHost } from '@agentg/framework/dashboard';

import type { FileRef } from '../../src/files/types.js';
import { TELEGRAM_DASHBOARD_METHODS } from '../contracts.js';
import type {
  FetchMessagesPageResult,
  GetMessageResult,
  RequestFileResult
} from './chat-messages/types.js';

export type TelegramDirectoryResult = {
  chats?: unknown;
  folders?: unknown;
  navigationChats?: unknown;
};

type ChatDirectoryInput = {
  query?: string | undefined;
  type?: string | undefined;
};

type MessageInput = {
  chatId: string;
  messageId: string;
};

type MessagesPageInput = {
  beforeMessageId?: string | undefined;
  chatId: string;
  limit: number;
};

type RequestFileInput = {
  owner: FileRef['owner'];
  slotKey: string;
};

export function useTelegramDashboardApi() {
  const host = useDashboardHost();

  return {
    chatDirectory(input: ChatDirectoryInput = {}): Promise<TelegramDirectoryResult> {
      return host.rpc<TelegramDirectoryResult>(TELEGRAM_DASHBOARD_METHODS.chatDirectory, input);
    },
    message(input: MessageInput): Promise<GetMessageResult> {
      return host.rpc<GetMessageResult>(TELEGRAM_DASHBOARD_METHODS.message, input);
    },
    messagesPage(input: MessagesPageInput): Promise<FetchMessagesPageResult> {
      return host.rpc<FetchMessagesPageResult>(TELEGRAM_DASHBOARD_METHODS.messagesPage, input);
    },
    requestFile(input: RequestFileInput): Promise<RequestFileResult> {
      return host.rpc<RequestFileResult>(TELEGRAM_DASHBOARD_METHODS.requestFile, input);
    }
  };
}
