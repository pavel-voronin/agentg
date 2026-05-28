import type { JsonValue } from '@agentg/events/json';
import { and, eq, sql, type SQL } from 'drizzle-orm';

import type { TelegramDatabase } from '../database.js';
import { telegramChatPositions, telegramChats } from '../schema.js';
import {
  telegramWireJsonObject,
  type TelegramWireChatAddedToListUpdate,
  type TelegramWireUpdateByType,
  type TelegramWireObject
} from '../tdlib/wire.js';
import { chatListKey } from './chatListKey.js';

type TelegramWireChatRemovedFromListUpdate = TelegramWireUpdateByType<'updateChatRemovedFromList'>;

export async function storeChatListMembership(
  database: TelegramDatabase,
  update: TelegramWireChatAddedToListUpdate
): Promise<void> {
  const chatList = telegramWireJsonObject(update.chat_list);
  const row: typeof telegramChats.$inferInsert = {
    chatLists: [chatList],
    id: String(update.chat_id)
  };

  await database
    .insert(telegramChats)
    .values(row)
    .onConflictDoUpdate({
      set: {
        chatLists: addChatListMembershipSql(chatListKey(update.chat_list), chatList)
      },
      target: telegramChats.id
    });
}

export async function removeChatListMembership(
  database: TelegramDatabase,
  update: TelegramWireChatRemovedFromListUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  const listKey = chatListKey(update.chat_list);
  const row: typeof telegramChats.$inferInsert = {
    chatLists: [],
    id: chatId
  };

  await database
    .insert(telegramChats)
    .values(row)
    .onConflictDoUpdate({
      set: {
        chatLists: removeChatListMembershipSql(listKey)
      },
      target: telegramChats.id
    });

  await database
    .delete(telegramChatPositions)
    .where(
      and(eq(telegramChatPositions.chatId, chatId), eq(telegramChatPositions.listKey, listKey))
    );
}

function addChatListMembershipSql(listKey: string, chatList: TelegramWireObject): SQL<JsonValue> {
  return sql<JsonValue>`(
    coalesce(
      (
        select jsonb_agg(existing.value order by existing.ordinal)
        from jsonb_array_elements(
          case
            when jsonb_typeof(${telegramChats.chatLists}) = 'array' then ${telegramChats.chatLists}
            else '[]'::jsonb
          end
        ) with ordinality as existing(value, ordinal)
        where (
          case
            when existing.value->>'_' = 'chatListMain' then 'main'
            when existing.value->>'_' = 'chatListArchive' then 'archive'
            when existing.value->>'_' = 'chatListFolder'
              then 'folder:' || (existing.value->>'chat_folder_id')
            else existing.value->>'_'
          end
        ) is distinct from ${listKey}
      ),
      '[]'::jsonb
    ) || ${JSON.stringify([chatList])}::jsonb
  )`;
}

function removeChatListMembershipSql(listKey: string): SQL<JsonValue> {
  return sql<JsonValue>`(
    coalesce(
      (
        select jsonb_agg(existing.value order by existing.ordinal)
        from jsonb_array_elements(
          case
            when jsonb_typeof(${telegramChats.chatLists}) = 'array' then ${telegramChats.chatLists}
            else '[]'::jsonb
          end
        ) with ordinality as existing(value, ordinal)
        where (
          case
            when existing.value->>'_' = 'chatListMain' then 'main'
            when existing.value->>'_' = 'chatListArchive' then 'archive'
            when existing.value->>'_' = 'chatListFolder'
              then 'folder:' || (existing.value->>'chat_folder_id')
            else existing.value->>'_'
          end
        ) is distinct from ${listKey}
      ),
      '[]'::jsonb
    )
  )`;
}
