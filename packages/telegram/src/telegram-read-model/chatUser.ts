import type { JsonObject } from '@agentg/events/json';
import { inArray, sql } from 'drizzle-orm';

import type { TelegramDatabase } from '../database.js';
import { telegramUsers } from '../schema.js';
import { asPlainRecord, stringifyTelegramId } from './chat.js';

export type TelegramChatUserInfo = {
  isBot: boolean;
  isPremium: boolean | null;
  telegramUserId: string;
};

export async function readTelegramChatUsersByChat(
  database: TelegramDatabase,
  chats: JsonObject[]
): Promise<Map<string, TelegramChatUserInfo>> {
  const userIds = chats.map(telegramChatUserId).filter(isDefined);
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

export function telegramChatUserId(chat: JsonObject): string | undefined {
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
