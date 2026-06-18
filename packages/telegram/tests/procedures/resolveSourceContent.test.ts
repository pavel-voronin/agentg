import { describe, expect, it, vi } from 'vitest';

import type { Message } from '../../src/domain/models/message.js';
import { resolveSourceContentProcedure } from '../../src/procedures/resolveSourceContent.js';
import type { ProcedureResources } from '../../src/procedures/resources.js';

const state = vi.hoisted(() => ({
  messages: {
    listRecent: vi.fn(),
    search: vi.fn()
  },
  runGetMessages: vi.fn()
}));

vi.mock('../../src/repositories/repositories.js', () => ({
  createRepositories: () => ({
    messages: state.messages
  })
}));

vi.mock('../../src/procedures/get-messages/procedure.js', () => ({
  runGetMessages: state.runGetMessages
}));

describe('Telegram source content resolver', () => {
  it('resolves recent messages into neutral refs and payload', async () => {
    state.messages.listRecent.mockResolvedValueOnce([message('1001', '42')]);

    const result = await resolveSourceContentProcedure(resources())({
      sourceSelector: {
        domain: 'telegram',
        selector: {
          chatId: '1001',
          kind: 'recentMessages',
          limit: 10
        }
      }
    });

    expect(state.messages.listRecent).toHaveBeenCalledWith({
      chatId: '1001',
      limit: 10
    });
    expect(result).toEqual({
      snapshot: {
        contentRefs: [
          {
            _model: 'telegram.message',
            id: '1001:42',
            sourceRef: {
              _model: 'telegram.chat',
              id: '1001'
            }
          }
        ],
        payload: {
          messages: [
            {
              chatId: '1001',
              contentType: 'messageText',
              messageDate: '2026-06-19T00:00:00.000Z',
              messageId: '42',
              senderDisplayName: 'Alice',
              telegramMessageId: '420',
              text: 'hello'
            }
          ],
          selector: {
            chatId: '1001',
            kind: 'recentMessages',
            limit: 10
          }
        },
        sourceRefs: [
          {
            _model: 'telegram.chat',
            id: '1001'
          }
        ]
      },
      status: 'ready'
    });
  });

  it('passes pending materialization for explicit message reads', async () => {
    state.runGetMessages.mockResolvedValueOnce({
      requestId: 'req_1',
      status: 'pending'
    });

    const result = await resolveSourceContentProcedure(resources())({
      sourceSelector: {
        domain: 'telegram',
        selector: {
          kind: 'messages',
          owner: {
            chatId: '1001',
            kind: 'chat'
          },
          selector: {
            count: 20,
            kind: 'page'
          }
        }
      }
    });

    expect(state.runGetMessages).toHaveBeenCalledWith(
      {
        owner: {
          chatId: '1001',
          kind: 'chat'
        },
        selector: {
          count: 20,
          kind: 'page'
        }
      },
      expect.any(Object)
    );
    expect(result).toEqual({
      requestId: 'req_1',
      sourceRefs: [
        {
          _model: 'telegram.chat',
          id: '1001'
        }
      ],
      status: 'pending'
    });
  });

  it('resolves search without a chat into a search source when no messages match', async () => {
    state.messages.search.mockResolvedValueOnce([]);

    const result = await resolveSourceContentProcedure(resources())({
      sourceSelector: {
        domain: 'telegram',
        selector: {
          kind: 'searchMessages',
          limit: 5,
          query: 'release'
        }
      }
    });

    expect(state.messages.search).toHaveBeenCalledWith({
      chatId: undefined,
      limit: 5,
      query: 'release'
    });
    expect(result).toEqual({
      snapshot: {
        contentRefs: [],
        payload: {
          messages: [],
          selector: {
            kind: 'searchMessages',
            limit: 5,
            query: 'release'
          }
        },
        sourceRefs: [
          {
            _model: 'telegram.search',
            id: 'release'
          }
        ]
      },
      status: 'ready'
    });
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

function message(chatId: string, id: string): Message {
  return {
    _model: 'telegram.message',
    chat: {
      _model: 'telegram.chat',
      id: chatId
    },
    contentType: 'messageText',
    deletedAt: null,
    editDate: null,
    id,
    isDeleted: false,
    isOutgoing: false,
    media: {
      files: []
    },
    messageDate: '2026-06-19T00:00:00.000Z',
    reactions: [],
    replyTo: null,
    sender: {
      _model: 'telegram.user',
      id: '7'
    },
    senderDisplayName: 'Alice',
    senderType: 'user',
    serviceAction: null,
    telegramMessageId: '420',
    text: 'hello',
    textEntities: []
  };
}
