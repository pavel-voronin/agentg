import type { EventBus } from '@agentg/framework';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { TELEGRAM_DASHBOARD_METHODS } from '../contracts.js';
import type { Database } from '../../src/database/client.js';
import type { telegramClient } from '../../src/index.js';
import {
  telegramChatFolderInfos,
  telegramChats,
  telegramMessages
} from '../../src/database/schema.js';
import { chatSearchWhere, readChatSelection, toChatStorageRow } from '../../src/views/chat.js';
import { readMessageSelection, toReadMessages } from '../../src/views/message.js';
import { andSql } from '../../src/views/sql.js';
import {
  chatFolderEntry,
  chatTypeCounts,
  listableChatDirectoryEntries,
  toChatDirectoryEntries
} from './chatDirectory.js';
import {
  chatDirectoryInputSchema,
  chatDirectoryOutputSchema,
  fileRequestInputSchema,
  fileRequestOutputSchema,
  messageLookupInputSchema,
  messageLookupOutputSchema,
  getMessagesInputSchema,
  getMessagesOutputSchema,
  type ChatFolder
} from './models.js';

type ChatDirectoryInput = z.infer<typeof chatDirectoryInputSchema>;
type ChatDirectoryOutput = z.infer<typeof chatDirectoryOutputSchema>;
type FileRequestInput = z.infer<typeof fileRequestInputSchema>;
type FileRequestOutput = z.infer<typeof fileRequestOutputSchema>;
type MessageLookupInput = z.infer<typeof messageLookupInputSchema>;
type MessageLookupOutput = z.infer<typeof messageLookupOutputSchema>;
type GetMessagesInput = z.infer<typeof getMessagesInputSchema>;
type GetMessagesOutput = z.infer<typeof getMessagesOutputSchema>;
type TelegramDashboardClient = Pick<
  ReturnType<typeof telegramClient>,
  'getMessages' | 'requestFile'
>;

type Resources = {
  database: Database;
  events: EventBus;
  telegram: TelegramDashboardClient;
};

export function createProcedures(resources: Resources) {
  return {
    [TELEGRAM_DASHBOARD_METHODS.chatDirectory]: async (
      input: unknown
    ): Promise<ChatDirectoryOutput> => {
      const output = await runChatDirectory(chatDirectoryInputSchema.parse(input), resources);
      return chatDirectoryOutputSchema.parse(output);
    },
    [TELEGRAM_DASHBOARD_METHODS.message]: async (input: unknown): Promise<MessageLookupOutput> => {
      const output = await runMessage(messageLookupInputSchema.parse(input), resources);
      return messageLookupOutputSchema.parse(output);
    },
    [TELEGRAM_DASHBOARD_METHODS.getMessages]: async (
      input: unknown
    ): Promise<GetMessagesOutput> => {
      const output = await runGetMessages(getMessagesInputSchema.parse(input), resources);
      return getMessagesOutputSchema.parse(output);
    },
    [TELEGRAM_DASHBOARD_METHODS.requestFile]: async (
      input: unknown
    ): Promise<FileRequestOutput> => {
      const output = await requestFile(fileRequestInputSchema.parse(input), resources);
      return fileRequestOutputSchema.parse(output);
    }
  };
}

async function runChatDirectory(
  input: ChatDirectoryInput,
  resources: Resources
): Promise<ChatDirectoryOutput> {
  const searchQuery = input.query?.trim();
  const type = input.type?.trim();
  const queryWhere =
    searchQuery === undefined || searchQuery.length === 0
      ? undefined
      : chatSearchWhere(searchQuery);
  const typeWhere =
    type === undefined
      ? undefined
      : sql`${telegramChats.type}->>'_' = ${chatTypeToTdlibConstructor(type)}`;
  const where = andSql(queryWhere, typeWhere);
  const navigationWhere = typeWhere;

  const [matchingChats, navigationChats, folders] = await Promise.all([
    resources.database
      .select(readChatSelection())
      .from(telegramChats)
      .where(where)
      .orderBy(asc(telegramChats.title), asc(telegramChats.id)),
    resources.database
      .select(readChatSelection())
      .from(telegramChats)
      .where(navigationWhere)
      .orderBy(asc(telegramChats.title), asc(telegramChats.id)),
    resources.database
      .select({
        icon: telegramChatFolderInfos.icon,
        id: telegramChatFolderInfos.id,
        name: telegramChatFolderInfos.name,
        position: telegramChatFolderInfos.position
      })
      .from(telegramChatFolderInfos)
      .orderBy(asc(telegramChatFolderInfos.position), asc(telegramChatFolderInfos.id))
  ]);
  const chats = listableChatDirectoryEntries(
    await toChatDirectoryEntries(resources.database, matchingChats.map(toChatStorageRow))
  );
  const navigation = listableChatDirectoryEntries(
    await toChatDirectoryEntries(resources.database, navigationChats.map(toChatStorageRow))
  );
  const folderEntries: ChatFolder[] = folders.map(chatFolderEntry);

  return {
    chats,
    folders: folderEntries,
    navigationChats: navigation,
    types: chatTypeCounts(navigation)
  };
}

async function runMessage(
  input: MessageLookupInput,
  resources: Resources
): Promise<MessageLookupOutput> {
  const [message] = await resources.database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(and(eq(telegramMessages.chatId, input.chatId), eq(telegramMessages.id, input.messageId)))
    .limit(1);
  const [readMessage] = await toReadMessages(
    resources.database,
    message === undefined ? [] : [message]
  );

  return {
    message: readMessage ?? null
  };
}

async function runGetMessages(
  input: GetMessagesInput,
  resources: Resources
): Promise<GetMessagesOutput> {
  return resources.telegram.getMessages(input);
}

async function requestFile(
  input: FileRequestInput,
  resources: Resources
): Promise<FileRequestOutput> {
  return resources.telegram.requestFile(input);
}

function chatTypeToTdlibConstructor(type: string): string {
  if (type === 'private') {
    return 'chatTypePrivate';
  }
  if (type === 'secret') {
    return 'chatTypeSecret';
  }
  if (type === 'channel' || type === 'group') {
    return 'chatTypeSupergroup';
  }
  return type;
}
