import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Message } from '../../src/domain/models/message.js';
import {
  dataExpandProcedure,
  dataRenderProcedure,
  dataSelectProcedure
} from '../../src/procedures/dataProvider.js';
import type { ProcedureResources } from '../../src/procedures/resources.js';

const state = vi.hoisted(() => ({
  repositories: {
    chats: {
      list: vi.fn()
    },
    messages: {
      list: vi.fn(),
      read: vi.fn()
    }
  }
}));

vi.mock('../../src/repositories/repositories.js', () => ({
  createRepositories: () => state.repositories
}));

describe('Telegram data provider procedures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unsupported provider filter keys before reading chats', async () => {
    await expect(
      dataSelectProcedure(resources())({
        model: 'telegram.chat',
        where: {
          chatID: '1001'
        }
      })
    ).rejects.toThrow();
    expect(state.repositories.chats.list).not.toHaveBeenCalled();
  });

  it('returns an empty chat dataset for an empty chat id filter', async () => {
    await expect(
      dataSelectProcedure(resources())({
        model: 'telegram.chat',
        where: {
          chatIds: []
        }
      })
    ).resolves.toEqual({
      rows: []
    });
    expect(state.repositories.chats.list).not.toHaveBeenCalled();
  });

  it('maps chat sorts to repository order before reading chats', async () => {
    state.repositories.chats.list.mockResolvedValueOnce([]);

    await expect(
      dataSelectProcedure(resources())({
        model: 'telegram.chat',
        sort: { direction: 'desc', key: 'title' }
      })
    ).resolves.toEqual({
      rows: []
    });
    expect(state.repositories.chats.list).toHaveBeenCalledWith({
      order: { direction: 'desc', key: 'title' }
    });
  });

  it('maps negative chat text filters before reading chats', async () => {
    state.repositories.chats.list.mockResolvedValueOnce([]);

    await expect(
      dataSelectProcedure(resources())({
        model: 'telegram.chat',
        where: {
          titleQueryNot: 'archive'
        }
      })
    ).resolves.toEqual({
      rows: []
    });
    expect(state.repositories.chats.list).toHaveBeenCalledWith({
      titleQueryNot: 'archive'
    });
  });

  it('selects messages through repository filters before rendering dataset rows', async () => {
    state.repositories.messages.list.mockResolvedValueOnce([
      message({
        chatId: '1001',
        messageDate: '2026-05-10T12:00:00.000Z',
        messageId: '42',
        text: 'hello'
      })
    ]);

    const result = await dataSelectProcedure(resources())({
      limit: 10,
      model: 'telegram.message',
      sort: { direction: 'asc', key: 'primaryRef' },
      where: {
        chatId: '1001',
        endAt: '2026-06-01T00:00:00.000Z',
        messageIds: ['42'],
        readState: 'unread',
        senderQueryNot: 'Muted',
        startAt: '2026-05-01T00:00:00.000Z',
        textQueryNot: 'draft'
      }
    });

    expect(state.repositories.messages.list).toHaveBeenCalledWith({
      chatId: '1001',
      endAt: '2026-06-01T00:00:00.000Z',
      limit: 10,
      messageIds: ['42'],
      order: { direction: 'asc', key: 'id' },
      readState: 'unread',
      senderQueryNot: 'Muted',
      startAt: '2026-05-01T00:00:00.000Z',
      textQueryNot: 'draft'
    });
    expect(result.rows.map((row) => ({ lineage: row.lineage, refs: row.refs }))).toEqual([
      {
        lineage: [
          { _model: 'telegram.chat', id: '1001' },
          { _model: 'telegram.message', id: '1001:42' }
        ],
        refs: {
          chat: { _model: 'telegram.chat', id: '1001' },
          message: { _model: 'telegram.message', id: '1001:42' }
        }
      }
    ]);
    expect(result.rows[0]?.value).toMatchObject({
      _model: 'telegram.message',
      chat: { _model: 'telegram.chat', id: '1001' },
      telegramMessageId: '42',
      text: 'hello'
    });
  });

  it('rejects message id filters without a chat id', async () => {
    await expect(
      dataSelectProcedure(resources())({
        model: 'telegram.message',
        where: {
          messageIds: ['42']
        }
      })
    ).rejects.toThrow('Telegram messageIds filter requires chatId');
    expect(state.repositories.messages.list).not.toHaveBeenCalled();
  });

  it('expands chat rows into filtered message rows without reading chat metadata again', async () => {
    state.repositories.messages.list.mockResolvedValueOnce([
      message({
        chatId: '1001',
        messageDate: '2026-05-10T12:00:00.000Z',
        messageId: '42',
        text: 'hello'
      })
    ]);

    const result = await dataExpandProcedure(resources())({
      from: [
        {
          lineage: [{ _model: 'telegram.chat', id: '1001' }],
          refs: {
            chat: { _model: 'telegram.chat', id: '1001' }
          },
          value: { title: 'Subcreative Community' }
        }
      ],
      limit: 5,
      relation: 'messages',
      sourceRef: 'chat',
      where: {
        endAt: '2026-06-01T00:00:00.000Z',
        messageIds: ['42'],
        readState: 'read',
        startAt: '2026-05-01T00:00:00.000Z'
      }
    });

    expect(state.repositories.chats.list).not.toHaveBeenCalled();
    expect(state.repositories.messages.list).toHaveBeenCalledWith({
      chatId: '1001',
      endAt: '2026-06-01T00:00:00.000Z',
      limit: 5,
      messageIds: ['42'],
      readState: 'read',
      startAt: '2026-05-01T00:00:00.000Z'
    });
    expect(result.rows[0]?.lineage).toEqual([
      { _model: 'telegram.chat', id: '1001' },
      { _model: 'telegram.message', id: '1001:42' }
    ]);
  });

  it('renders messages grouped by chat refs', () => {
    const result = dataRenderProcedure()({
      format: 'text',
      from: [
        renderedMessageRow('1001', '42', 'Alice', 'hello'),
        renderedMessageRow('1002', '7', 'Bob', 'world')
      ],
      options: {
        groupByRef: 'chat'
      },
      sourceRef: 'message'
    });

    expect(result.rows).toEqual([
      {
        lineage: [
          { _model: 'telegram.chat', id: '1001' },
          { _model: 'telegram.message', id: '1001:42' }
        ],
        refs: {
          chat: { _model: 'telegram.chat', id: '1001' }
        },
        value: '2026-05-10T12:00:00.000Z Alice hello'
      },
      {
        lineage: [
          { _model: 'telegram.chat', id: '1002' },
          { _model: 'telegram.message', id: '1002:7' }
        ],
        refs: {
          chat: { _model: 'telegram.chat', id: '1002' }
        },
        value: '2026-05-10T12:00:00.000Z Bob world'
      }
    ]);
  });
});

function resources(): ProcedureResources {
  return {
    database: {},
    events: {},
    files: {},
    reconciler: {}
  } as ProcedureResources;
}

function renderedMessageRow(
  chatId: string,
  messageId: string,
  senderDisplayName: string,
  text: string
) {
  const chat = { _model: 'telegram.chat' as const, id: chatId };
  const messageRef = { _model: 'telegram.message' as const, id: `${chatId}:${messageId}` };
  return {
    lineage: [chat, messageRef],
    refs: {
      chat,
      message: messageRef
    },
    value: {
      messageDate: '2026-05-10T12:00:00.000Z',
      senderDisplayName,
      text
    }
  };
}

function message(input: {
  chatId: string;
  messageDate: string;
  messageId: string;
  text: string;
}): Message {
  return {
    _model: 'telegram.message',
    chat: {
      _model: 'telegram.chat',
      id: input.chatId
    },
    contentType: 'messageText',
    deletedAt: null,
    editDate: null,
    id: `${input.chatId}:${input.messageId}`,
    isDeleted: false,
    isOutgoing: false,
    media: {
      files: []
    },
    messageDate: input.messageDate,
    reactions: [],
    replyTo: null,
    sender: {
      _model: 'telegram.user',
      id: '7'
    },
    senderDisplayName: 'Alice',
    senderType: 'messageSenderUser',
    serviceAction: null,
    telegramMessageId: input.messageId,
    text: input.text,
    textEntities: []
  };
}
