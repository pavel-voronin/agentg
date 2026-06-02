import type { JsonObject } from '@agentg/framework';
import { inArray, sql } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramUsers } from '../database/schema.js';
import { asPlainRecord, stringifyTelegramId } from './chat.js';

export type ChatUserInfo = {
  isBot: boolean;
  isPremium: boolean | null;
  telegramUserId: string;
};

export async function readChatUsersByChat(
  database: Database,
  chats: JsonObject[]
): Promise<Map<string, ChatUserInfo>> {
  const userIds = chats.map(chatUserId).filter(isDefined);
  if (userIds.length === 0) {
    return new Map();
  }

  const users = await database
    .select({
      isBot: sqlBooleanUserIsBot(),
      isPremium: telegramUsers.isPremium,
      telegramUserId: telegramUsers.id
    })
    .from(telegramUsers)
    .where(inArray(telegramUsers.id, userIds));

  return new Map(users.map((user) => [user.telegramUserId, user]));
}

export function chatUserId(chat: JsonObject): string | undefined {
  const type = asPlainRecord(chat.type);
  const userId = type?.user_id ?? type?.userId;
  return stringifyTelegramId(userId);
}

function sqlBooleanUserIsBot() {
  return sql<boolean>`coalesce(${telegramUsers.type}->>'_' = 'userTypeBot', false)`;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
