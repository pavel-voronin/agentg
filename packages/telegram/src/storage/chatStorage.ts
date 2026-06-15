import type { JsonValue } from '@agentg/framework';
import { and, eq, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramChatPositions, telegramChats } from '../database/schema.js';
import type {
  ChatListMembership,
  ChatPositionState,
  ChatState,
  ChatPatch
} from '../domain/models/chatState.js';

export type ChatStorageRow = typeof telegramChats.$inferInsert;
export type ChatPositionStorageRow = typeof telegramChatPositions.$inferInsert;

export async function saveChatState(
  database: Database,
  chat: ChatState,
  positions: readonly ChatPositionState[]
): Promise<void> {
  await database.transaction(async (transaction) => {
    await upsertChatPatch(transaction, chat);
    await replaceChatPositionStates(transaction, chat.id, positions);
  });
}

export async function upsertChatPatch(database: Database, chat: ChatPatch): Promise<void> {
  const row = chatStorageState(chat);
  await database.insert(telegramChats).values(row).onConflictDoUpdate({
    set: row,
    target: telegramChats.id
  });
}

export async function replaceChatPositionStates(
  database: Database,
  chatId: string,
  positions: readonly ChatPositionState[]
): Promise<void> {
  await database.delete(telegramChatPositions).where(eq(telegramChatPositions.chatId, chatId));

  const rows = uniqueChatPositionStorageRows(positions);
  if (rows.length === 0) {
    return;
  }

  await database
    .insert(telegramChatPositions)
    .values(rows)
    .onConflictDoUpdate({
      set: {
        isPinned: sql.raw('excluded."is_pinned"'),
        order: sql.raw('excluded."order"'),
        source: sql.raw('excluded."source"')
      },
      target: [telegramChatPositions.chatId, telegramChatPositions.listKey]
    });
}

export async function upsertChatPositionState(
  database: Database,
  position: ChatPositionState
): Promise<void> {
  const row = chatPositionStorageRow(position);
  await database
    .insert(telegramChatPositions)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramChatPositions.chatId, telegramChatPositions.listKey]
    });
}

export async function deleteChatPositionState(
  database: Database,
  input: {
    chatId: string;
    listKey: string;
  }
): Promise<void> {
  await database
    .delete(telegramChatPositions)
    .where(
      and(
        eq(telegramChatPositions.chatId, input.chatId),
        eq(telegramChatPositions.listKey, input.listKey)
      )
    );
}

export async function addChatListMembership(
  database: Database,
  membership: ChatListMembership
): Promise<void> {
  const row: ChatStorageRow = {
    chatLists: [membership.chatList],
    id: membership.chatId
  };

  await database
    .insert(telegramChats)
    .values(row)
    .onConflictDoUpdate({
      set: {
        chatLists: addChatListMembershipSql(membership.listKey, membership.chatList)
      },
      target: telegramChats.id
    });
}

export async function removeChatListMembership(
  database: Database,
  membership: Omit<ChatListMembership, 'chatList'>
): Promise<void> {
  const row: ChatStorageRow = {
    chatLists: [],
    id: membership.chatId
  };

  await database.transaction(async (transaction) => {
    await transaction
      .insert(telegramChats)
      .values(row)
      .onConflictDoUpdate({
        set: {
          chatLists: removeChatListMembershipSql(membership.listKey)
        },
        target: telegramChats.id
      });

    await deleteChatPositionState(transaction, membership);
  });
}

function chatStorageState(chat: ChatPatch): ChatStorageRow {
  return chat;
}

function chatPositionStorageRow(position: ChatPositionState): ChatPositionStorageRow {
  return position;
}

function uniqueChatPositionStorageRows(
  positions: readonly ChatPositionState[]
): ChatPositionStorageRow[] {
  const rowsByKey = new Map<string, ChatPositionStorageRow>();
  for (const position of positions) {
    const row = chatPositionStorageRow(position);
    rowsByKey.set(`${row.chatId}:${row.listKey}`, row);
  }
  return [...rowsByKey.values()];
}

function addChatListMembershipSql(listKey: string, chatList: JsonValue): SQL<JsonValue> {
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
