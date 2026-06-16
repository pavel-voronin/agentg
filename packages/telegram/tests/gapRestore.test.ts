import { describe, expect, it, vi } from 'vitest';

import {
  historyGapRestoreRulesPolicy,
  type HistoryGapRestoreRuleSet
} from '../policies/policies.js';
import type { Database } from '../src/database/client.js';
import { planRequest, selectDecision } from '../src/gap-restore/planner.js';
import { createRestoreService, runRestore } from '../src/gap-restore/runtime.js';

describe('Telegram history gap restore rules', () => {
  it('rejects invalid rule specs', () => {
    expect(() =>
      parseSpec({
        restore: true
      })
    ).toThrow();
    expect(() =>
      parseSpec({
        restore: false,
        windowSeconds: 60
      })
    ).toThrow();
    expect(() =>
      parseSpec({
        chatIds: ['123'],
        chatTypes: ['channel'],
        restore: true,
        windowSeconds: 60
      })
    ).toThrow();
    expect(() =>
      parseSpec({
        chatTypes: ['group', 'group'],
        restore: true,
        windowSeconds: 60
      })
    ).toThrow();
  });

  it('resolves rules by chat id, chat type, then all chats', () => {
    const rules = resolveRules([
      {
        restore: true,
        windowSeconds: 3600
      },
      {
        chatTypes: ['private'],
        restore: false
      },
      {
        chatIds: ['123'],
        restore: true,
        windowSeconds: 86400
      }
    ]);

    expect(
      selectDecision(rules, {
        chatId: '123',
        type: 'private'
      })
    ).toEqual({
      kind: 'enabled',
      windowSeconds: 86400
    });
    expect(
      selectDecision(rules, {
        chatId: '456',
        type: 'private'
      })
    ).toEqual({
      kind: 'disabled'
    });
    expect(
      selectDecision(rules, {
        chatId: '789',
        type: 'channel'
      })
    ).toEqual({
      kind: 'enabled',
      windowSeconds: 3600
    });
  });

  it('rejects conflicting decisions for one atomic key', () => {
    expect(() =>
      resolveRules([
        {
          chatTypes: ['group'],
          restore: true,
          windowSeconds: 60
        },
        {
          chatTypes: ['group'],
          restore: true,
          windowSeconds: 120
        }
      ])
    ).toThrow('chatType:group');

    expect(() =>
      resolveRules([
        {
          chatTypes: ['group'],
          restore: true,
          windowSeconds: 60
        },
        {
          chatTypes: ['group'],
          restore: true,
          windowSeconds: 60
        }
      ])
    ).not.toThrow();
  });
});

describe('Telegram history gap restore planner', () => {
  it('plans one bounded getMessages range before live coverage', () => {
    const plan = planRequest({
      chat: {
        chatId: '123',
        type: 'channel'
      },
      decision: {
        kind: 'enabled',
        windowSeconds: 86400
      },
      liveBoundary: new Date('2026-06-15T10:00:00.000Z')
    });

    expect(plan).toEqual({
      input: {
        owner: {
          chatId: '123',
          kind: 'chat'
        },
        selector: {
          endAt: '2026-06-15T10:00:00.000Z',
          kind: 'range',
          startAt: '2026-06-14T10:00:00.000Z'
        }
      },
      kind: 'request'
    });
  });

  it('skips disabled and boundary-less chats', () => {
    expect(
      planRequest({
        chat: {
          chatId: '123',
          type: 'private'
        },
        decision: {
          kind: 'disabled'
        },
        liveBoundary: new Date('2026-06-15T10:00:00.000Z')
      })
    ).toEqual({
      kind: 'skip',
      reason: 'restoreDisabled'
    });
    expect(
      planRequest({
        chat: {
          chatId: '456',
          type: 'channel'
        },
        decision: {
          kind: 'enabled',
          windowSeconds: 60
        },
        liveBoundary: null
      })
    ).toEqual({
      kind: 'skip',
      reason: 'missingLiveBoundary'
    });
  });
});

describe('Telegram history gap restore runtime', () => {
  it('applies restorable chat selection before policy matching', async () => {
    const rules = resolveRules([
      {
        restore: true,
        windowSeconds: 60
      },
      {
        chatIds: ['200'],
        restore: true,
        windowSeconds: 120
      },
      {
        chatTypes: ['group'],
        restore: true,
        windowSeconds: 180
      }
    ]);
    const getMessages = vi.fn().mockResolvedValue({
      messages: [],
      status: 'ready'
    });
    const service = createRestoreService({
      database: restoreServiceDatabase({
        chats: [
          restoreChatRow('100', 'channel', [{ _: 'chatListMain' }]),
          restoreChatRow('200', 'private', []),
          restoreChatRow('300', 'group', [{ _: 'chatListArchive' }]),
          restoreChatRow('400', 'group', null),
          restoreChatRow('500', 'unsupported', [{ _: 'chatListMain' }])
        ],
        liveBoundaries: [new Date('2026-06-15T10:01:00.000Z'), new Date('2026-06-15T10:03:00.000Z')]
      }),
      getMessages,
      getRules: () => rules
    });

    const result = await service.restore();

    expect(getMessages).toHaveBeenCalledTimes(2);
    expect(getMessages).toHaveBeenNthCalledWith(1, {
      owner: {
        chatId: '100',
        kind: 'chat'
      },
      selector: {
        endAt: '2026-06-15T10:01:00.000Z',
        kind: 'range',
        startAt: '2026-06-15T10:00:00.000Z'
      }
    });
    expect(getMessages).toHaveBeenNthCalledWith(2, {
      owner: {
        chatId: '300',
        kind: 'chat'
      },
      selector: {
        endAt: '2026-06-15T10:03:00.000Z',
        kind: 'range',
        startAt: '2026-06-15T10:00:00.000Z'
      }
    });
    expect(result).toEqual({
      failedRequests: 0,
      requestedChats: 2,
      skippedChats: 0,
      status: 'ready',
      totalChats: 2
    });
  });

  it('calls getMessages directly for planned ranges and continues after one chat fails', async () => {
    const rules = resolveRules([
      {
        restore: true,
        windowSeconds: 60
      },
      {
        chatTypes: ['private'],
        restore: false
      }
    ]);
    const getMessages = vi
      .fn()
      .mockResolvedValueOnce({
        messages: [],
        status: 'ready'
      })
      .mockResolvedValueOnce({
        requestId: 'request-2',
        status: 'pending'
      })
      .mockRejectedValueOnce(new Error('getMessages failed'));
    const logger = {
      error: vi.fn(),
      info: vi.fn()
    };

    const result = await runRestore({
      getMessages,
      getRules: () => rules,
      logger,
      store: {
        listChats: () =>
          Promise.resolve([
            {
              chatId: '100',
              type: 'channel'
            },
            {
              chatId: '200',
              type: 'private'
            },
            {
              chatId: '300',
              type: 'group'
            },
            {
              chatId: '400',
              type: 'group'
            }
          ]),
        readLiveBoundary: (chatId) =>
          Promise.resolve(
            new Date(
              {
                '100': '2026-06-15T10:01:00.000Z',
                '300': '2026-06-15T10:03:00.000Z',
                '400': '2026-06-15T10:04:00.000Z'
              }[chatId] ?? '2026-06-15T10:00:00.000Z'
            )
          )
      }
    });

    expect(getMessages).toHaveBeenCalledTimes(3);
    expect(getMessages).toHaveBeenNthCalledWith(1, {
      owner: {
        chatId: '100',
        kind: 'chat'
      },
      selector: {
        endAt: '2026-06-15T10:01:00.000Z',
        kind: 'range',
        startAt: '2026-06-15T10:00:00.000Z'
      }
    });
    expect(getMessages).toHaveBeenNthCalledWith(2, {
      owner: {
        chatId: '300',
        kind: 'chat'
      },
      selector: {
        endAt: '2026-06-15T10:03:00.000Z',
        kind: 'range',
        startAt: '2026-06-15T10:02:00.000Z'
      }
    });
    expect(result).toEqual({
      failedRequests: 1,
      requestedChats: 3,
      skippedChats: 1,
      status: 'failed',
      totalChats: 4
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'telegram.history_gap_restore_finished',
        status: 'failed'
      }),
      'telegram history gap restore finished'
    );
  });
});

function parseSpec(input: unknown) {
  return historyGapRestoreRulesPolicy.spec.parse(input);
}

function resolveRules(inputs: unknown[]): HistoryGapRestoreRuleSet {
  return historyGapRestoreRulesPolicy.resolve(
    inputs.map((input, index) => ({
      metadata: {
        name: `rule${String(index)}`
      },
      spec: parseSpec(input)
    }))
  );
}

type RestoreServiceDatabaseInput = {
  chats: RestoreChatRow[];
  liveBoundaries: Date[];
};

type RestoreChatRow = {
  chatLists: unknown;
  telegramChatId: string;
  type: string;
};

function restoreServiceDatabase(input: RestoreServiceDatabaseInput): Database {
  const liveBoundaries = [...input.liveBoundaries];

  return {
    select(selection: Record<string, unknown>) {
      if ('telegramChatId' in selection) {
        return {
          from() {
            return {
              where() {
                return {
                  orderBy() {
                    return Promise.resolve(input.chats);
                  }
                };
              }
            };
          }
        };
      }

      return {
        from() {
          return {
            innerJoin() {
              return {
                where() {
                  return {
                    orderBy() {
                      return {
                        limit() {
                          const startAt = liveBoundaries.shift();
                          return Promise.resolve(
                            startAt === undefined
                              ? []
                              : [
                                  {
                                    eligibleFrom: startAt,
                                    startAt
                                  }
                                ]
                          );
                        }
                      };
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

function restoreChatRow(telegramChatId: string, type: string, chatLists: unknown): RestoreChatRow {
  return {
    chatLists,
    telegramChatId,
    type
  };
}
