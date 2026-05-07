import { describe, expect, it } from 'vitest';

import type { TelegramDatabase } from '../src/database.js';
import { createTelegramHistoryRouter } from '../src/rpc/history-router.js';

describe('Telegram history router chat listing', () => {
  it('filters chats without TDLib list placements from the chat directory', async () => {
    const visible = chatRow({
      id: 'chat-visible',
      positions: [{ list: { _: 'chatListMain' }, order: '100' }],
      title: 'Visible',
      type: 'group'
    });
    const orphan = chatRow({
      id: 'chat-orphan',
      positions: [],
      title: 'Orphan',
      type: 'channel'
    });
    const database = createFakeDatabase([[visible, orphan], [visible, orphan], []]);
    const caller = createCaller(database);

    await expect(caller.listChatDirectory({})).resolves.toMatchObject({
      chats: [
        {
          id: 'chat-visible',
          placements: [{ kind: 'main', order: '100' }]
        }
      ],
      navigationChats: [
        {
          id: 'chat-visible'
        }
      ],
      types: [{ count: 1, type: 'group' }]
    });
  });

  it('filters chats without TDLib list placements from history discovery inputs', async () => {
    const database = createFakeDatabase([
      [
        chatRow({
          id: 'chat-visible',
          positions: [{ list: { _: 'chatListArchive' }, order: '200' }],
          title: 'Visible',
          type: 'channel'
        }),
        chatRow({
          id: 'chat-orphan',
          positions: [],
          title: 'Orphan',
          type: 'channel'
        })
      ]
    ]);
    const caller = createCaller(database);

    await expect(caller.listChats({ discover: false })).resolves.toEqual([
      {
        _model: 'telegram.chat',
        id: 'chat-visible',
        title: 'Visible',
        type: 'channel'
      }
    ]);
  });

  it('returns unavailable history facts for chats without TDLib list placements', async () => {
    const database = createFakeDatabase([
      [
        chatRow({
          id: 'chat-orphan',
          positions: [],
          title: 'Orphan',
          type: 'channel'
        })
      ]
    ]);
    const caller = createCaller(database);

    await expect(caller.getChatHistoryFacts({ chatId: 'chat-orphan' })).resolves.toEqual({
      chat: null,
      earliestMessageDate: null,
      messageCount: 0
    });
    expect(database.selectCalls()).toBe(1);
  });
});

function createCaller(database: ReturnType<typeof createFakeDatabase>) {
  return createTelegramHistoryRouter({
    client: {} as never,
    database: database as unknown as TelegramDatabase,
    eventBus: {} as never
  }).createCaller({});
}

function createFakeDatabase(results: unknown[][]) {
  let selectCallCount = 0;
  return {
    select(): unknown {
      const result = results[selectCallCount] ?? [];
      selectCallCount += 1;
      return thenableQuery(result);
    },
    selectCalls(): number {
      return selectCallCount;
    }
  };
}

function thenableQuery(result: unknown[]) {
  const query = {
    from() {
      return query;
    },
    groupBy() {
      return query;
    },
    limit() {
      return query;
    },
    orderBy() {
      return query;
    },
    then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(result).then(resolve, reject);
    },
    where() {
      return query;
    }
  };
  return query;
}

function chatRow(input: {
  id: string;
  positions: Record<string, unknown>[];
  title: string;
  type: string;
}) {
  return {
    id: input.id,
    raw: {
      _: 'chat',
      id: input.id,
      positions: input.positions,
      title: input.title
    },
    telegramChatId: input.id,
    title: input.title,
    type: input.type,
    updatedAt: new Date('2026-05-01T00:00:00.000Z')
  };
}
