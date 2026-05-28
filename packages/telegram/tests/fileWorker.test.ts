import { describe, expect, it } from 'vitest';

import {
  telegramFileDownloadRequest,
  type TelegramFileDownloadRow
} from '../src/files/subsystem.js';

describe('Telegram file download worker', () => {
  it('uses TDLib download list transport for message-owned files', () => {
    expect(
      telegramFileDownloadRequest({
        ...downloadRow(),
        latestTdlibFileId: 123,
        priority: 32,
        transport: {
          chatId: -10042,
          kind: 'message',
          messageId: 777
        }
      })
    ).toEqual({
      _: 'addFileToDownloads',
      chat_id: -10042,
      file_id: 123,
      message_id: 777,
      priority: 32
    });
  });

  it('uses async downloadFile transport for non-message files', () => {
    expect(
      telegramFileDownloadRequest({
        ...downloadRow(),
        latestTdlibFileId: 456,
        priority: 8,
        transport: {
          kind: 'file'
        }
      })
    ).toEqual({
      _: 'downloadFile',
      file_id: 456,
      limit: 0,
      offset: 0,
      priority: 8,
      synchronous: false
    });
  });

  it('rejects priorities outside TDLib native range', () => {
    expect(() =>
      telegramFileDownloadRequest({
        ...downloadRow(),
        priority: 33
      })
    ).toThrow('TDLib priority must be an integer from 1 to 32');
  });
});

function downloadRow(): TelegramFileDownloadRow {
  return {
    assetKey: 'asset-a',
    byteSize: 1024,
    fileName: 'file.jpg',
    latestTdlibFileId: 1,
    mimeType: 'image/jpeg',
    priority: 16,
    transport: {
      kind: 'file'
    }
  };
}
