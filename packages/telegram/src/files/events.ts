import {
  ownerKey,
  readFileOwnersForAssets,
  readFileQueueStats,
  readFileRefsForOwners
} from './read.js';
import { publishFileOwnerChanged, publishFileQueueChanged } from '../events.js';
import type { FileSubsystemOptions } from './runtime.js';
import { recordQueueStatsTelemetry } from './telemetry.js';
import type { FileOwnerChangedEvent, FileOwnerKey } from './types.js';

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
  await publishFileOwnersUpdated(options, owners);
  await publishFileQueueUpdated(options);
}

export function publishFileOwnerUpdated(
  options: FileEventOptions,
  owner: FileOwnerKey
): Promise<void> {
  return publishFileOwnersUpdated(options, [owner]);
}

export async function publishFileOwnersUpdated(
  options: FileEventOptions,
  owners: FileOwnerKey[]
): Promise<void> {
  const uniqueOwners = [...new Map(owners.map((owner) => [ownerKey(owner), owner])).values()];
  if (uniqueOwners.length === 0) {
    return;
  }

  const filesByOwner = await readFileRefsForOwners(options.database, uniqueOwners);
  const updatedAt = new Date().toISOString();
  for (const owner of uniqueOwners) {
    const event: FileOwnerChangedEvent = {
      files: filesByOwner.get(ownerKey(owner)) ?? [],
      owner,
      updatedAt
    };
    publishFileOwnerChanged(options.events, event);
  }
}

export async function publishFileQueueUpdated(options: FileEventOptions): Promise<void> {
  const stats = await readFileQueueStats(options.database);
  recordQueueStatsTelemetry(stats);
  publishFileQueueChanged(options.events, stats);
}
