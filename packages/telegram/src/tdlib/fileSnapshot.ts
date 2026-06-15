import type { file as TdlibFile } from 'tdlib-types';

import type { FileSnapshot } from '../domain/models/fileSnapshot.js';

export function fileSnapshotFromTdlibFile(file: TdlibFile): FileSnapshot {
  return {
    expectedSize: file.expected_size,
    id: file.id,
    local: {
      can_be_deleted: file.local.can_be_deleted,
      can_be_downloaded: file.local.can_be_downloaded,
      download_offset: file.local.download_offset,
      downloaded_prefix_size: file.local.downloaded_prefix_size,
      downloaded_size: file.local.downloaded_size,
      is_downloading_active: file.local.is_downloading_active,
      is_downloading_completed: file.local.is_downloading_completed,
      path: file.local.path
    },
    remote: {
      id: file.remote.id,
      is_uploading_active: file.remote.is_uploading_active,
      is_uploading_completed: file.remote.is_uploading_completed,
      unique_id: file.remote.unique_id,
      uploaded_size: file.remote.uploaded_size
    },
    size: file.size
  };
}
