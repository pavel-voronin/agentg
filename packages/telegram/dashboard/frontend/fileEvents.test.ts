import { describe, expect, it } from 'vitest';

import { normalizeFileOwnerChangedEvent } from './fileEvents.js';

describe('Telegram Dashboard file events', () => {
  it('normalizes full ownerChanged events with file refs', () => {
    expect(
      normalizeFileOwnerChangedEvent({
        data: {
          files: [
            {
              _model: 'telegram.file',
              canRequest: false,
              id: 'telegram.message:chat-1:100:photo.main',
              mediaKind: 'photo',
              owner: {
                _model: 'telegram.message',
                id: 'chat-1:100'
              },
              renderKind: 'image',
              slotKey: 'photo.main',
              status: 'ready',
              updatedAt: '2026-06-10T00:00:00.000Z',
              url: '/telegram-files/agentg-media/file.jpg'
            }
          ],
          owner: {
            ownerId: 'chat-1:100',
            ownerModel: 'telegram.message'
          },
          updatedAt: '2026-06-10T00:00:00.000Z'
        },
        type: 'telegram.files.ownerChanged'
      })
    ).toMatchObject({
      files: [
        {
          id: 'telegram.message:chat-1:100:photo.main',
          owner: {
            _model: 'telegram.message',
            id: 'chat-1:100'
          },
          slotKey: 'photo.main',
          status: 'ready',
          url: '/telegram-files/agentg-media/file.jpg'
        }
      ],
      owner: {
        ownerId: 'chat-1:100',
        ownerModel: 'telegram.message'
      },
      updatedAt: '2026-06-10T00:00:00.000Z'
    });
  });

  it('rejects key-only ownerChanged events', () => {
    expect(
      normalizeFileOwnerChangedEvent({
        data: {
          owner: {
            ownerId: 'chat-1:100',
            ownerModel: 'telegram.message'
          },
          updatedAt: '2026-06-10T00:00:00.000Z'
        },
        type: 'telegram.files.ownerChanged'
      })
    ).toBeNull();
  });
});
