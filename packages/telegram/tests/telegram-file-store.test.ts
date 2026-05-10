import { describe, expect, it } from 'vitest';

import type { TelegramDatabase } from '../src/database.js';
import {
  parseTelegramFileProgressUpdate,
  readTelegramFileDownloadRow
} from '../src/telegram-file-store.js';

describe('Telegram file store', () => {
  it('parses completed TDLib updateFile progress', () => {
    expect(
      parseTelegramFileProgressUpdate({
        _: 'updateFile',
        file: {
          id: 123,
          local: {
            downloaded_size: 4096,
            is_downloading_completed: true,
            path: '/tdlib/files/photo.jpg'
          }
        }
      })
    ).toEqual({
      downloadedByteSize: 4096,
      isCompleted: true,
      localPath: '/tdlib/files/photo.jpg',
      tdlibFileId: 123
    });
  });

  it('rejects non-updateFile progress payloads', () => {
    expect(
      parseTelegramFileProgressUpdate({
        _: 'updateNewMessage',
        file: {
          id: 123,
          local: {
            downloaded_size: 4096
          }
        }
      })
    ).toBeNull();
  });

  it('uses deterministic owner ordering when resolving a download row transport', async () => {
    const database = createReadDownloadRowDatabase({
      assetKey: 'asset-shared',
      byteSize: 1024,
      fileName: 'shared.jpg',
      latestTdlibFileId: 456,
      mimeType: 'image/jpeg',
      ownerId: '-10042:777',
      ownerModel: 'telegram.message',
      priority: 16
    });

    await expect(readTelegramFileDownloadRow(database, 'asset-shared')).resolves.toMatchObject({
      assetKey: 'asset-shared',
      transport: {
        chatId: -10042,
        kind: 'message',
        messageId: 777
      }
    });
    expect(database.orderByArgumentCount()).toBe(4);
  });
});

function createReadDownloadRowDatabase(row: Record<string, unknown>) {
  let orderByArgumentCount = 0;
  const query = {
    from() {
      return query;
    },
    innerJoin() {
      return query;
    },
    leftJoin() {
      return query;
    },
    limit() {
      return query;
    },
    orderBy(...args: unknown[]) {
      orderByArgumentCount = args.length;
      return query;
    },
    then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve([row]).then(resolve, reject);
    },
    where() {
      return query;
    }
  };
  return {
    orderByArgumentCount() {
      return orderByArgumentCount;
    },
    select() {
      return query;
    }
  } as unknown as TelegramDatabase & {
    orderByArgumentCount(): number;
  };
}
