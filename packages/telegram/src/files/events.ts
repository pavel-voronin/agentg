import { readFileOwnersForAssets, readFileQueueStats } from './read.js';
import type { FileSubsystemOptions } from './runtime.js';
import { recordQueueStatsTelemetry } from './telemetry.js';
import type { FileOwnerKey } from './types.js';

type FileEventOptions = Pick<FileSubsystemOptions, 'database' | 'events'>;

export async function publishAssetOwnersAndQueue(
  options: FileEventOptions,
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

export function publishFileOwnerUpdated(options: FileEventOptions, owner: FileOwnerKey): void {
  // TODO(file-event-consumers): this neutral event replaced old direct projection updates for
  // active notifications, chat directory entries, default backgrounds, emoji chat themes, and
  // read-message cards. Add consumers that rebuild those projections from
  // `telegram.files.ownerChanged`; otherwise file changes will be stored correctly but
  // already-mounted views will not learn about the changed file slots.
  options.events.publish('telegram.files.ownerChanged', owner);
}

export async function publishFileQueueUpdated(options: FileEventOptions): Promise<void> {
  const stats = await readFileQueueStats(options.database);
  recordQueueStatsTelemetry(stats);
  options.events.publish('telegram.files.queueChanged', stats);
}
