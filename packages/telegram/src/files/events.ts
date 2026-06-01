import { readFileOwnersForAssets, readFileQueueStats } from './read.js';
import type { FileSubsystemOptions } from './runtime.js';
import type { FileOwnerKey } from './types.js';

export async function publishAssetOwnersAndQueue(
  options: FileSubsystemOptions,
  assetKeys: string[]
): Promise<void> {
  const uniqueAssetKeys = [...new Set(assetKeys)];
  if (uniqueAssetKeys.length === 0) {
    return;
  }

  const owners = await readFileOwnersForAssets(options.database, uniqueAssetKeys);
  for (const owner of owners) {
    publishFileOwnerUpdated(options, owner);
  }
  await publishFileQueueUpdated(options);
}

export function publishFileOwnerUpdated(options: FileSubsystemOptions, owner: FileOwnerKey): void {
  // TODO(file-event-consumers): this neutral event replaced old direct projection updates for
  // active notifications, chat directory entries, default backgrounds, emoji chat themes, and
  // read-message cards. Add consumers that rebuild those projections from
  // `telegram.files.ownerChanged`; otherwise file changes will be stored correctly but
  // already-mounted views will not learn about the changed file slots.
  options.events.publish('telegram.files.ownerChanged', owner);
}

export async function publishFileQueueUpdated(options: FileSubsystemOptions): Promise<void> {
  // TODO(file-event-consumers): this neutral event replaced the old typed file-queue projection
  // event. File queue consumers must subscribe to this and re-read queue stats.
  options.events.publish('telegram.files.queueChanged', await readFileQueueStats(options.database));
}
