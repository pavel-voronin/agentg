import { describe, expect, it, vi } from 'vitest';

import { createFileOperations } from '../../src/tdlib/fileOperations.js';
import type { Tdlib } from '../../src/tdlib/index.js';

describe('TDLib file operations adapter', () => {
  it('maps TDLib file payloads to domain snapshots', async () => {
    const tdlib = {
      getFile: vi.fn().mockResolvedValue(tdlibFile())
    } as unknown as Tdlib;
    const operations = createFileOperations(tdlib);

    await expect(operations.getFile({ fileId: 10 })).resolves.toMatchObject({
      expectedSize: 100,
      id: 10,
      local: {
        is_downloading_completed: true,
        path: '/tmp/file.bin'
      },
      remote: {
        id: 'remote',
        unique_id: 'unique'
      },
      size: 100
    });
  });

  it('keeps non-file TDLib getFile results unavailable', async () => {
    const tdlib = {
      getFile: vi.fn().mockResolvedValue({ _: 'error', code: 404, message: 'not found' })
    } as unknown as Tdlib;
    const operations = createFileOperations(tdlib);

    await expect(operations.getFile({ fileId: 10 })).resolves.toBeUndefined();
  });
});

function tdlibFile(): unknown {
  return {
    _: 'file',
    expected_size: 100,
    id: 10,
    local: {
      _: 'localFile',
      can_be_deleted: true,
      can_be_downloaded: true,
      download_offset: 0,
      downloaded_prefix_size: 100,
      downloaded_size: 100,
      is_downloading_active: false,
      is_downloading_completed: true,
      path: '/tmp/file.bin'
    },
    remote: {
      _: 'remoteFile',
      id: 'remote',
      is_uploading_active: false,
      is_uploading_completed: true,
      unique_id: 'unique',
      uploaded_size: 100
    },
    size: 100
  };
}
