import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../../../src/database/client.js';
import { readPageEndAt } from '../../../src/procedures/get-messages/read.js';

describe('Telegram getMessages local reads', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('anchors latest page readiness to the newest local message instead of wall clock now', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T14:00:00.000Z'));

    const endAt = await readPageEndAt(
      pageEndDatabase([
        {
          messageDate: new Date('2026-06-12T12:34:56.000Z')
        }
      ]),
      {
        chatId: '123',
        kind: 'chat'
      },
      undefined
    );

    expect(endAt?.toISOString()).toBe('2026-06-12T12:34:57.000Z');
  });

  it('returns no latest page boundary when the owner has no local messages', async () => {
    const endAt = await readPageEndAt(
      pageEndDatabase([]),
      {
        chatId: '123',
        kind: 'chat'
      },
      undefined
    );

    expect(endAt).toBeUndefined();
  });
});

function pageEndDatabase(rows: { messageDate: Date | null }[]): Database {
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
                      return Promise.resolve(rows);
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
