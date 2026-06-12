import type { SQL } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../../src/database/client.js';
import { processMessageSlotMaterializationBatch } from '../../src/files/messageSlots.js';
import { recordFileSlotUpdate } from '../../src/files/persistence.js';
import type { FileSubsystemOptions } from '../../src/files/runtime.js';

vi.mock('../../src/files/persistence.js', () => ({
  recordFileSlotUpdate: vi.fn(() => Promise.resolve(false))
}));

describe('Telegram message file slot materialization', () => {
  it('materializes stored messages and marks messages without files as processed', async () => {
    const updates: unknown[] = [];
    const database = messageSlotDatabase({
      onUpdate(value) {
        updates.push(value);
      },
      rows: [
        {
          chatId: '123',
          content: {
            _: 'messageText',
            text: {
              _: 'formattedText',
              text: 'hello'
            }
          },
          messageId: '456'
        }
      ]
    });

    const result = await processMessageSlotMaterializationBatch(
      {
        database
      } as FileSubsystemOptions,
      25
    );

    expect(result).toEqual({
      hasMore: false,
      processedCount: 1,
      queueChanged: false
    });
    expect(recordFileSlotUpdate).toHaveBeenCalledWith(
      {
        database
      },
      {
        message: {
          chatId: '123',
          content: {
            _: 'messageText',
            text: {
              _: 'formattedText',
              text: 'hello'
            }
          },
          messageId: '456'
        }
      },
      'history_fetch'
    );
    expect(updates).toHaveLength(1);
  });

  it('reports continuation when the batch fills its limit', async () => {
    const database = messageSlotDatabase({
      onUpdate() {
        return undefined;
      },
      rows: [
        {
          chatId: '123',
          content: {
            _: 'messageText'
          },
          messageId: '456'
        }
      ]
    });

    const result = await processMessageSlotMaterializationBatch(
      {
        database
      } as FileSubsystemOptions,
      1
    );

    expect(result.hasMore).toBe(true);
  });
});

function messageSlotDatabase(input: {
  onUpdate(value: unknown): void;
  rows: { chatId: string; content: unknown; messageId: string }[];
}): Database {
  return {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                orderBy() {
                  return {
                    limit() {
                      return Promise.resolve(input.rows);
                    }
                  };
                }
              };
            }
          };
        }
      };
    },
    update() {
      return {
        set(value: unknown) {
          input.onUpdate(value);
          return {
            where(condition: SQL) {
              void condition;
              return Promise.resolve([]);
            }
          };
        }
      };
    }
  } as unknown as Database;
}
