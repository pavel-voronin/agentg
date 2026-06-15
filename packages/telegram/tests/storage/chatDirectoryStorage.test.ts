import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import type { Database } from '../../src/database/client.js';
import type { ChatDirectoryType } from '../../src/domain/models/chatDirectory.js';
import { readChatDirectoryRows } from '../../src/storage/chatDirectoryStorage.js';

describe('Telegram chat directory storage', () => {
  it('uses distinct SQL predicates for supergroup chats and channels', async () => {
    const groupWhere = await directoryTypeWhere('group');
    const channelWhere = await directoryTypeWhere('channel');

    expect(groupWhere.sql).toContain('"telegram_chats"."type"->>\'_\' = \'chatTypeSupergroup\'');
    expect(groupWhere.sql).toContain('"telegram_chats"."type"->>\'is_channel\' = \'false\'');
    expect(channelWhere.sql).toContain('"telegram_chats"."type"->>\'_\' = \'chatTypeSupergroup\'');
    expect(channelWhere.sql).toContain('"telegram_chats"."type"->>\'is_channel\' = \'true\'');
    expect(channelWhere.sql).not.toBe(groupWhere.sql);
  });

  it('does not apply supergroup channel predicates to private chats', async () => {
    const privateWhere = await directoryTypeWhere('private');

    expect(privateWhere.sql).toContain('"telegram_chats"."type"->>\'_\' = \'chatTypePrivate\'');
    expect(privateWhere.sql).not.toContain('is_channel');
  });
});

async function directoryTypeWhere(
  type: ChatDirectoryType
): Promise<{ params: unknown[]; sql: string }> {
  const wheres: (SQL | undefined)[] = [];
  await readChatDirectoryRows(directoryDatabase(wheres), { type });
  const where = wheres[0];
  if (where === undefined) {
    throw new Error('Expected chat directory type predicate');
  }
  return new PgDialect().sqlToQuery(where);
}

function directoryDatabase(wheres: (SQL | undefined)[]): Database {
  return {
    select() {
      return {
        from() {
          return {
            orderBy() {
              return Promise.resolve([]);
            },
            where(condition: SQL | undefined) {
              wheres.push(condition);
              return {
                orderBy() {
                  return Promise.resolve([]);
                }
              };
            }
          };
        }
      };
    }
  } as unknown as Database;
}
