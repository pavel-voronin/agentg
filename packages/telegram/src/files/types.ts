import type { FileSnapshot } from '../domain/models/fileSnapshot.js';
import type {
  FileMediaKind,
  FileOwner,
  FileOwnerKey,
  FileOwnerModel,
  FileRef,
  FileRenderKind,
  FileStatus
} from '../domain/models/fileRef.js';
import {
  fileMediaKinds,
  fileRefId,
  fileRenderKinds,
  fileStatuses
} from '../domain/models/fileRef.js';

export { fileMediaKinds, fileRefId, fileRenderKinds, fileStatuses };
export type {
  FileMediaKind,
  FileOwner,
  FileOwnerKey,
  FileOwnerModel,
  FileRef,
  FileRenderKind,
  FileStatus
};

export type FileOwnerChangedEvent = {
  files: FileRef[];
  owner: FileOwnerKey;
  updatedAt: string;
};

export type FileFailureReasonCount = {
  count: number;
  reason:
    | 'missing_tdlib_file_id'
    | 'not_found'
    | 'stale_tdlib_pointer'
    | 'stale_retry_limit'
    | 'storage_io'
    | 'tdlib_path_outside_source_roots'
    | 'unknown';
};

export type FileQueueStats = {
  downloadingCount: number;
  failedCount: number;
  failureReasonCounts: FileFailureReasonCount[];
  knownCount: number;
  knownDownloadedBytes: number;
  knownRemainingBytes: number;
  knownTotalBytes: number;
  oldestDownloadingAgeSeconds: number;
  oldestDownloadingUnixSeconds: number;
  queuedCount: number;
  readyCount: number;
  readyDownloadedBytes: number;
  remainingCount: number;
  staleDownloadingCount: number;
  totalCount: number;
  unknownRemainingCount: number;
};

export type ExtractedFileSlot = {
  byteSize: number | null;
  durationSeconds: number | null;
  file: FileSnapshot;
  fileName: string | null;
  height: number | null;
  mediaKind: FileMediaKind;
  mimeType: string | null;
  owner: FileOwner;
  renderKind: FileRenderKind;
  slotKey: string;
  tdlibFileId: number;
  width: number | null;
};
