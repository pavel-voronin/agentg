import { timeTelemetrySpan, type JsonValue } from '@agentg/framework';
import { inArray, sql } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramChats, telegramMessages, telegramUsers } from '../database/schema.js';
import type { MessageTextEntity } from '../domain/models/message.js';
import type { DateLike } from '../domain/models/scalars.js';
import { messageRef } from '../model/refs.js';
import { messageTextEntitiesFromJson } from './messageTextStorage.js';

const METRIC_MESSAGE_VIEW_STAGE_DURATION = 'telegram.message_view.stage.duration';

export type SenderDisplayInfo = {
  displayName: string;
};

export type MessageStorageRow = {
  contentType: string;
  deletedAt: DateLike | null;
  editDate: DateLike | null;
  isDeleted: boolean;
  isOutgoing: boolean;
  messageDate: DateLike | null;
  reactions: JsonValue | null;
  replyChatId: string | null;
  replyMessageId: string | null;
  senderId: string | null;
  senderType: string | null;
  telegramChatId: string;
  telegramMessageId: string;
  text: string | null;
  textEntities: MessageTextEntity[];
};

type SenderRow = {
  senderId: string | null;
  senderType: string | null;
};

export type SelectedMessageStorageRow = Omit<MessageStorageRow, 'textEntities'> & {
  textEntities: JsonValue | null;
};

export function readMessageSelection() {
  return {
    contentType: sql<string>`coalesce(${telegramMessages.content}->>'_', 'unknown')`,
    deletedAt: sql<null>`null`,
    editDate: telegramMessages.editDate,
    isDeleted: sql<boolean>`false`,
    isOutgoing: sql<boolean>`coalesce(${telegramMessages.isOutgoing}, false)`,
    messageDate: telegramMessages.date,
    reactions: telegramMessages.reactions,
    replyChatId: sql<string | null>`coalesce(
      ${telegramMessages.replyTo}->>'chat_id',
      ${telegramMessages.replyTo}->>'chatId'
    )`,
    replyMessageId: sql<string | null>`coalesce(
      ${telegramMessages.replyTo}->>'message_id',
      ${telegramMessages.replyTo}->>'messageId'
    )`,
    senderId: sql<
      string | null
    >`coalesce(${telegramMessages.senderId}->>'user_id', ${telegramMessages.senderId}->>'chat_id')`,
    senderType: sql<string | null>`${telegramMessages.senderId}->>'_'`,
    telegramChatId: telegramMessages.chatId,
    telegramMessageId: telegramMessages.id,
    text: messageTextExpression(),
    textEntities: messageTextEntitiesExpression()
  };
}

export function toMessageStorageRow(row: SelectedMessageStorageRow): MessageStorageRow {
  return {
    ...row,
    textEntities: messageTextEntitiesFromJson(row.text, row.textEntities)
  };
}

export function toMessageStorageRows(rows: SelectedMessageStorageRow[]): MessageStorageRow[] {
  return rows.map(toMessageStorageRow);
}

export function messageTextExpression() {
  return sql<string | null>`coalesce(
    ${telegramMessages.content}->'text'->>'text',
    ${telegramMessages.content}->'caption'->>'text'
  )`;
}

export function messageTextEntitiesExpression() {
  return sql<JsonValue | null>`case
    when ${telegramMessages.content}->'text'->>'text' is not null
      then ${telegramMessages.content}->'text'->'entities'
    when ${telegramMessages.content}->'caption'->>'text' is not null
      then ${telegramMessages.content}->'caption'->'entities'
    else null
  end`;
}

export async function readMessageSenderDisplayInfo(
  database: Database,
  messages: SenderRow[]
): Promise<Map<string, SenderDisplayInfo>> {
  return timeMessageViewStage('sender_lookup', async () => {
    const userIds = dedupeStrings(
      messages
        .filter((message) => message.senderType === 'messageSenderUser')
        .map((message) => message.senderId)
        .filter(isString)
    );
    const chatIds = dedupeStrings(
      messages
        .filter((message) => message.senderType === 'messageSenderChat')
        .map((message) => message.senderId)
        .filter(isString)
    );
    const senderInfoByKey = new Map<string, SenderDisplayInfo>();

    if (userIds.length > 0) {
      const users = await database
        .select({
          firstName: telegramUsers.firstName,
          lastName: telegramUsers.lastName,
          telegramUserId: telegramUsers.id
        })
        .from(telegramUsers)
        .where(inArray(telegramUsers.id, userIds));
      for (const user of users) {
        const key = senderDisplayKey('messageSenderUser', user.telegramUserId);
        if (key !== null) {
          senderInfoByKey.set(key, {
            displayName: userDisplayName(user)
          });
        }
      }
    }

    if (chatIds.length > 0) {
      const chats = await database
        .select({
          telegramChatId: telegramChats.id,
          title: telegramChats.title
        })
        .from(telegramChats)
        .where(inArray(telegramChats.id, chatIds));
      for (const chat of chats) {
        const key = senderDisplayKey('messageSenderChat', chat.telegramChatId);
        if (key !== null) {
          senderInfoByKey.set(key, {
            displayName: chat.title ?? chat.telegramChatId
          });
        }
      }
    }

    return senderInfoByKey;
  });
}

export function senderDisplayKey(
  senderType: string | null,
  senderId: string | null
): string | null {
  if (senderId === null || senderType === null) {
    return null;
  }
  if (senderType === 'messageSenderUser') {
    return `telegram.user:${senderId}`;
  }
  if (senderType === 'messageSenderChat') {
    return `telegram.chat:${senderId}`;
  }
  return null;
}

export function messageFileOwner(row: MessageStorageRow) {
  return {
    ownerId: messageRef({
      chatId: row.telegramChatId,
      messageId: row.telegramMessageId
    }).id,
    ownerModel: 'telegram.message' as const
  };
}

export function timeMessageViewStage<T>(stage: string, operation: () => Promise<T>): Promise<T> {
  const attributes = {
    'telegram.message_view.stage': stage
  };
  return timeTelemetrySpan(
    {
      attributes,
      metric: {
        attributes,
        name: METRIC_MESSAGE_VIEW_STAGE_DURATION
      },
      name: `telegram.message_view.${stage}`
    },
    operation
  );
}

function userDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
  telegramUserId: string;
}): string {
  const name = [user.firstName, user.lastName]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');
  if (name.length > 0) {
    return name;
  }
  return user.telegramUserId;
}

function isString(value: string | null | undefined): value is string {
  return typeof value === 'string';
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}
