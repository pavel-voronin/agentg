import { inArray, sql } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramUsers } from '../database/schema.js';

export type ChatUserInfo = {
  isBot: boolean;
  isPremium: boolean | null;
  telegramUserId: string;
};

export async function readChatUsersByIds(
  database: Database,
  inputUserIds: (string | null)[]
): Promise<Map<string, ChatUserInfo>> {
  const userIds = dedupeStrings(inputUserIds.filter(isString));
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

function sqlBooleanUserIsBot() {
  return sql<boolean>`coalesce(${telegramUsers.type}->>'_' = 'userTypeBot', false)`;
}

function isString(value: string | null): value is string {
  return typeof value === 'string';
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}
