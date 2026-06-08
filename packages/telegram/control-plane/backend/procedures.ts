import { parseLimit, type EventBus } from '@agentg/framework';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../src/database/client.js';
import {
  telegramChatFolderInfos,
  telegramChats,
  telegramFileAssets,
  telegramFileDownloadJobs,
  telegramFileSlots,
  telegramMessages
} from '../../src/database/schema.js';
import { readFileRef } from '../../src/files/read.js';
import { readStaticFileContent } from '../../src/files/staticFile.js';
import type { FileOwner } from '../../src/files/types.js';
import {
  assertMediaKind,
  downloadPriorityForCause,
  enqueueFileAssetDownload
} from '../../src/files/persistence.js';
import { decideFilePolicy } from '../../src/files/policy.js';
import { HISTORY_PAST_BOUNDARY, HISTORY_TICK_MS } from '../../src/history/time.js';
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
  fileContentInputSchema,
  fileContentOutputSchema,
  fileRequestInputSchema,
  fileRequestOutputSchema,
  messageLookupInputSchema,
  messageLookupOutputSchema,
  messagesPageInputSchema,
  messagesPageOutputSchema,
  type ChatFolder
} from './models.js';

const MESSAGE_PAGE_LIMIT = 100;
const MESSAGE_PAGE_MAX_LIMIT = 100;

type ChatDirectoryInput = z.infer<typeof chatDirectoryInputSchema>;
type ChatDirectoryOutput = z.infer<typeof chatDirectoryOutputSchema>;
type FileContentOutput = z.infer<typeof fileContentOutputSchema>;
type FileRequestInput = z.infer<typeof fileRequestInputSchema>;
type FileRequestOutput = z.infer<typeof fileRequestOutputSchema>;
type MessageLookupInput = z.infer<typeof messageLookupInputSchema>;
type MessageLookupOutput = z.infer<typeof messageLookupOutputSchema>;
type MessagesPageInput = z.infer<typeof messagesPageInputSchema>;
type MessagesPageOutput = z.infer<typeof messagesPageOutputSchema>;

type Resources = {
  callTelegramProcedure<T>(procedure: string, input: unknown): Promise<T>;
  database: Database;
  events: EventBus;
  filesDirectory: string;
};

type FetchPageResult =
  | {
      kind: 'anchor_before_start' | 'no_messages_before_end';
    }
  | {
      kind: 'page';
      reachedBeginning: boolean;
    };

type RequestFileSlotRow = {
  assetKey: string;
  assetStatus: string;
  byteSize: number | null;
  jobStatus: string | null;
  mediaKind: string;
};

export function procedures(resources: Resources) {
  return {
    'telegram.cp.chatDirectory': async (input: unknown): Promise<ChatDirectoryOutput> => {
      const output = await runChatDirectory(chatDirectoryInputSchema.parse(input), resources);
      return chatDirectoryOutputSchema.parse(output);
    },
    'telegram.cp.file': async (input: unknown): Promise<FileContentOutput> => {
      const file = await readStaticFileContent(
        resources.filesDirectory,
        fileContentInputSchema.parse(input).path
      );
      if (file === null) {
        throw new Error('File not found');
      }
      return fileContentOutputSchema.parse(file);
    },
    'telegram.cp.message': async (input: unknown): Promise<MessageLookupOutput> => {
      const output = await runMessage(messageLookupInputSchema.parse(input), resources);
      return messageLookupOutputSchema.parse(output);
    },
    'telegram.cp.messagesPage': async (input: unknown): Promise<MessagesPageOutput> => {
      const output = await runMessagesPage(messagesPageInputSchema.parse(input), resources);
      return messagesPageOutputSchema.parse(output);
    },
    'telegram.cp.requestFile': async (input: unknown): Promise<FileRequestOutput> => {
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

async function runMessagesPage(
  input: MessagesPageInput,
  resources: Resources
): Promise<MessagesPageOutput> {
  const limit = parseLimit(input.limit, MESSAGE_PAGE_LIMIT, MESSAGE_PAGE_MAX_LIMIT);
  const cursorMessageId = parseOptionalMessageId(input.beforeMessageId);
  const pageEndAt =
    cursorMessageId === undefined
      ? ceilToHistorySecond(new Date())
      : ((await readMessagePageEndAt(input.chatId, input.beforeMessageId, resources)) ??
        ceilToHistorySecond(new Date()));
  const fetchResult = await resources.callTelegramProcedure<FetchPageResult>('fetchPage', {
    chatId: input.chatId,
    ...(cursorMessageId === undefined ? {} : { cursorMessageId }),
    endAt: pageEndAt.toISOString(),
    limit,
    startAt: HISTORY_PAST_BOUNDARY.toISOString()
  });
  const messages = await readPersistedMessagesPage(
    {
      beforeMessageId: input.beforeMessageId,
      chatId: input.chatId,
      limit
    },
    resources
  );

  const reachedByFetch = fetchResult.kind === 'page' ? fetchResult.reachedBeginning : true;

  return {
    messages,
    reachedStart: reachedByFetch || messages.length < limit
  };
}

async function readMessagePageEndAt(
  chatId: string,
  messageId: string | undefined,
  resources: Resources
): Promise<Date | undefined> {
  if (messageId === undefined) {
    return undefined;
  }

  const [message] = await resources.database
    .select({
      messageDate: telegramMessages.date
    })
    .from(telegramMessages)
    .where(and(eq(telegramMessages.chatId, chatId), eq(telegramMessages.id, messageId)))
    .limit(1);

  return message?.messageDate === null || message?.messageDate === undefined
    ? undefined
    : nextHistorySecond(message.messageDate);
}

async function readPersistedMessagesPage(
  input: {
    beforeMessageId: string | undefined;
    chatId: string;
    limit: number;
  },
  resources: Resources
) {
  const before = parseOptionalMessageId(input.beforeMessageId);
  const rows = await resources.database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(
      andSql(
        eq(telegramMessages.chatId, input.chatId),
        before === undefined ? undefined : sql`${telegramMessages.id}::bigint < ${before}`
      )
    )
    .orderBy(sql`${telegramMessages.id}::bigint desc`)
    .limit(input.limit);

  return toReadMessages(resources.database, [...rows].reverse());
}

async function requestFile(
  input: FileRequestInput,
  resources: Resources
): Promise<FileRequestOutput> {
  const row = await readRequestFileSlotRow(resources.database, input.owner, input.slotKey);
  if (row === null) {
    return {
      decision: {
        action: 'deny',
        reason: 'file slot is not known'
      },
      file: null
    };
  }

  const decision = decideFilePolicy({
    cause: 'explicit_request',
    current: {
      sourceFingerprint: row.assetKey,
      status: row.jobStatus ?? row.assetStatus
    },
    slot: {
      byteSize: row.byteSize,
      mediaKind: assertMediaKind(row.mediaKind)
    },
    sourceFingerprint: row.assetKey
  });

  if (decision.action === 'enqueue' && row.assetStatus !== 'ready') {
    await enqueueFileAssetDownload(
      resources.database,
      row.assetKey,
      downloadPriorityForCause('explicit_request')
    );
    resources.events.publish('telegram.files.ownerChanged', {
      ownerId: input.owner.id,
      ownerModel: input.owner._model
    });
  }

  return {
    decision,
    file: await readFileRef(resources.database, input.owner, input.slotKey)
  };
}

async function readRequestFileSlotRow(
  database: Database,
  owner: FileOwner,
  slotKey: string
): Promise<RequestFileSlotRow | null> {
  const [row] = await database
    .select({
      assetKey: telegramFileSlots.assetKey,
      assetStatus: telegramFileAssets.status,
      byteSize: telegramFileSlots.byteSize,
      jobStatus: telegramFileDownloadJobs.status,
      mediaKind: telegramFileSlots.mediaKind
    })
    .from(telegramFileSlots)
    .innerJoin(telegramFileAssets, eq(telegramFileAssets.assetKey, telegramFileSlots.assetKey))
    .leftJoin(
      telegramFileDownloadJobs,
      eq(telegramFileDownloadJobs.assetKey, telegramFileSlots.assetKey)
    )
    .where(
      and(
        eq(telegramFileSlots.ownerModel, owner._model),
        eq(telegramFileSlots.ownerId, owner.id),
        eq(telegramFileSlots.slotKey, slotKey)
      )
    )
    .limit(1);

  return row ?? null;
}

function parseOptionalMessageId(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function nextHistorySecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / HISTORY_TICK_MS) * HISTORY_TICK_MS + HISTORY_TICK_MS);
}

function ceilToHistorySecond(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / HISTORY_TICK_MS) * HISTORY_TICK_MS);
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
