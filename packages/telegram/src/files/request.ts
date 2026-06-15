import { publishFileOwnerUpdated, publishFileQueueUpdated } from './events.js';
import {
  assertMediaKind,
  downloadPriorityForCause,
  enqueueFileAssetDownload
} from './persistence.js';
import { decideFilePolicy } from './policy.js';
import { readFileRef } from '../storage/fileReadStorage.js';
import { readRequestFileSlotRow } from '../storage/fileRequestStorage.js';
import type { FileRequestResult, FileSubsystemOptions } from './runtime.js';
import type { FileOwner } from './types.js';

type RequestFileSlotOptions = Pick<
  FileSubsystemOptions,
  'database' | 'events' | 'getDownloadRules'
>;

export async function requestFileSlot(
  options: RequestFileSlotOptions,
  input: { owner: FileOwner; slotKey: string }
): Promise<FileRequestResult> {
  const row = await readRequestFileSlotRow(options.database, input.owner, input.slotKey);
  if (row === null) {
    return {
      decision: {
        action: 'deny',
        reason: 'file slot is not known'
      },
      file: null
    };
  }

  const decision = decideFilePolicy({
    cause: 'explicit_request',
    current: {
      failureReason: row.downloadError,
      sourceFingerprint: row.assetKey,
      status: row.jobStatus ?? row.assetStatus
    },
    rules: options.getDownloadRules(),
    slot: {
      byteSize: row.byteSize,
      mediaKind: assertMediaKind(row.mediaKind)
    },
    sourceFingerprint: row.assetKey
  });

  if (decision.action === 'enqueue' && row.assetStatus !== 'ready') {
    await enqueueFileAssetDownload(
      options.database,
      row.assetKey,
      downloadPriorityForCause('explicit_request')
    );
    await publishFileOwnerUpdated(options, {
      ownerId: input.owner.id,
      ownerModel: input.owner._model
    });
    await publishFileQueueUpdated(options);
  }

  return {
    decision,
    file: await readFileRef(options.database, input.owner, input.slotKey)
  };
}
