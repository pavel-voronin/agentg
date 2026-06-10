import { describe, expect, it } from 'vitest';

import type { Database } from '../database/client.js';
import { chatRef } from '../model/refs.js';
import { readFileRef } from './read.js';

describe('Telegram file read model', () => {
  it('mints canonical ready media URLs', async () => {
    const file = await readFileRef(
      fileRefDatabase('agentg-media/ab/cd/file name.jpg'),
      chatRef('chat-1'),
      'photo.main'
    );

    expect(file?.url).toBe('/telegram-files/agentg-media/ab/cd/file%20name.jpg');
  });

  it.each([
    ['raw/file.jpg'],
    ['agentg-media/../file.jpg'],
    ['agentg-media/%2e%2e/file.jpg'],
    ['agentg-media/a%2Fb.jpg'],
    ['agentg-media/a\\b.jpg'],
    ['agentg-media//file.jpg']
  ])('does not mint non-canonical ready media URL for %s', async (relativePath) => {
    const file = await readFileRef(fileRefDatabase(relativePath), chatRef('chat-1'), 'photo.main');

    expect(file?.url).toBeNull();
  });

  it('does not mint URLs for non-ready assets', async () => {
    const file = await readFileRef(
      fileRefDatabase('agentg-media/file.jpg', 'known'),
      chatRef('chat-1'),
      'photo.main'
    );

    expect(file?.url).toBeNull();
  });
});

function fileRefDatabase(relativePath: string, status = 'ready'): Database {
  const now = new Date('2026-06-10T00:00:00.000Z');
  return {
    select() {
      return {
        from() {
          return {
            innerJoin() {
              return {
                leftJoin() {
                  return {
                    where() {
                      return Promise.resolve([
                        {
                          assetByteSize: 100,
                          assetDownloadError: null,
                          assetDownloadedByteSize: 100,
                          assetKey: 'telegram:asset-a',
                          assetRelativePath: relativePath,
                          assetStatus: status,
                          assetUpdatedAt: now,
                          byteSize: 100,
                          durationSeconds: null,
                          fileName: 'photo.jpg',
                          height: null,
                          jobStatus: null,
                          mediaKind: 'photo',
                          mimeType: 'image/jpeg',
                          ownerId: 'chat-1',
                          ownerModel: 'telegram.chat',
                          renderKind: 'image',
                          slotKey: 'photo.main',
                          slotUpdatedAt: now,
                          tdlibFileId: 10,
                          width: null
                        }
                      ]);
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
