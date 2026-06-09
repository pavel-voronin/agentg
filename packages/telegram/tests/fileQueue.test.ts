import { afterEach, describe, expect, it, vi } from 'vitest';

const logs = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('@agentg/framework', () => ({
  createLogger: () => ({
    warn(entry: Record<string, unknown>) {
      logs.push(entry);
    }
  }),
  logError: (error: unknown) => ({
    'error.type': error instanceof Error ? error.name : typeof error,
    error
  })
}));

import { fileDownloadRequest, logTdlibCleanupError } from '../src/files/queue.js';
import type { FileDownloadRow } from '../src/files/runtime.js';

describe('Telegram file download worker', () => {
  afterEach(() => {
    logs.length = 0;
    vi.restoreAllMocks();
  });

  it('uses TDLib download list transport for message-owned files', () => {
    expect(
      fileDownloadRequest({
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
      chatId: -10042,
      fileId: 123,
      kind: 'message',
      messageId: 777,
      priority: 32
    });
  });

  it('uses async downloadFile transport for non-message files', () => {
    expect(
      fileDownloadRequest({
        ...downloadRow(),
        latestTdlibFileId: 456,
        priority: 8,
        transport: {
          kind: 'file'
        }
      })
    ).toEqual({
      fileId: 456,
      kind: 'file',
      limit: 0,
      offset: 0,
      priority: 8,
      synchronous: false
    });
  });

  it('rejects priorities outside TDLib native range', () => {
    expect(() =>
      fileDownloadRequest({
        ...downloadRow(),
        priority: 33
      })
    ).toThrow('TDLib priority must be an integer from 1 to 32');
  });

  it("treats TDLib cleanup Can't find file as a no-op", () => {
    logTdlibCleanupError('asset-a', new Error("Can't find file"));

    expect(logs).toEqual([]);
  });

  it('keeps warning for real TDLib cleanup failures', () => {
    logTdlibCleanupError('asset-a', new Error('TDLib transport failed'));

    expect(logs).toEqual([
      expect.objectContaining({
        assetKey: 'asset-a',
        event: 'telegram.file_download_cleanup_failed'
      })
    ]);
  });
});

function downloadRow(): FileDownloadRow {
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
