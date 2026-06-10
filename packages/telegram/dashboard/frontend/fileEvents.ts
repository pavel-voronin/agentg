import type { DashboardHostEvent } from '@agentg/framework/dashboard';
import type { FileOwnerKey, FileRef } from '../../src/files/types.js';

import { normalizeFileRefs } from './fileRefs.js';

export type FileOwnerChangedPayload = {
  files: FileRef[];
  owner: FileOwnerKey;
  updatedAt: string;
};

export function normalizeFileOwnerChangedEvent(
  event: DashboardHostEvent
): FileOwnerChangedPayload | null {
  if (event.type !== 'telegram.files.ownerChanged') {
    return null;
  }
  const data = asRecord(event.data);
  const owner = asRecord(data?.owner);
  const ownerModel = asString(owner?.ownerModel);
  const ownerId = asString(owner?.ownerId);
  const updatedAt = asString(data?.updatedAt);
  if (
    ownerId === undefined ||
    !isFileOwnerModel(ownerModel) ||
    updatedAt === undefined ||
    !Array.isArray(data?.files)
  ) {
    return null;
  }

  return {
    files: normalizeFileRefs(data.files),
    owner: {
      ownerId,
      ownerModel
    },
    updatedAt
  };
}

export function fileOwnerEventKey(event: FileOwnerChangedPayload): string {
  return `${event.owner.ownerModel}:${event.owner.ownerId}`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isFileOwnerModel(value: string | undefined): value is FileOwnerKey['ownerModel'] {
  return (
    value === 'telegram.activeNotification' ||
    value === 'telegram.chat' ||
    value === 'telegram.defaultBackground' ||
    value === 'telegram.emojiChatThemes' ||
    value === 'telegram.message' ||
    value === 'telegram.quickReplyMessage' ||
    value === 'telegram.stickerSet' ||
    value === 'telegram.story' ||
    value === 'telegram.user'
  );
}
