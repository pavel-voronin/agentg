import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import type { Database } from '../../src/database/client.js';
import { createChatRepository } from '../../src/repositories/chatRepository.js';

describe('Telegram chat repository', () => {
  it('pushes chat filters and limit into the chat list query', async () => {
    const captured: CapturedChatListQuery = {};

    await createChatRepository(chatListDatabase(captured)).list({
      folderId: 7,
      limit: 1,
      pinned: true,
      readState: 'unread',
      titleQueryNot: 'Muted',
      type: 'group'
    });

    expect(captured.limit).toBe(1);
    const where = captured.where;
    if (where === undefined) {
      throw new Error('Expected chat list predicate');
    }
    const compiled = new PgDialect().sqlToQuery(where);
    expect(compiled.sql).toContain('"telegram_chats"."type"->>\'_\' = \'chatTypeBasicGroup\'');
    expect(compiled.sql).toContain('"telegram_chats"."type"->>\'_\' = \'chatTypeSupergroup\'');
    expect(compiled.sql).toContain('"telegram_chats"."is_marked_as_unread"');
    expect(compiled.sql).toContain('exists');
    expect(compiled.sql).toContain('"telegram_chat_positions"."list_key"');
    expect(compiled.sql).toContain('"telegram_chat_positions"."is_pinned"');
    expect(compiled.sql).toContain('not (');
    expect(compiled.params).toEqual(expect.arrayContaining(['%Muted%', 'folder:7', true]));
  });
});

type CapturedChatListQuery = {
  limit?: number | undefined;
  where?: SQL | undefined;
};

function chatListDatabase(captured: CapturedChatListQuery): Database {
  return {
    select() {
      return {
        from() {
          return {
            where(condition: SQL | undefined) {
              captured.where = condition;
              return {
                orderBy() {
                  return {
                    limit(limit: number) {
                      captured.limit = limit;
                      return Promise.resolve([]);
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  } as unknown as Database;
}
