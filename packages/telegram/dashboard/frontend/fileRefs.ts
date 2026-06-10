import type { FileRef } from '../../src/files/types.js';

export function normalizeFileRef(value: Record<string, unknown> | undefined): FileRef | null {
  const id = asString(value?.id);
  const owner = normalizeFileOwner(value?.owner);
  const slotKey = asString(value?.slotKey);
  const status = asString(value?.status);
  const mediaKind = asString(value?.mediaKind);
  const renderKind = asString(value?.renderKind);
  const updatedAt = asString(value?.updatedAt);
  if (
    id === undefined ||
    owner === null ||
    slotKey === undefined ||
    !isFileStatus(status) ||
    !isFileMediaKind(mediaKind) ||
    !isFileRenderKind(renderKind) ||
    updatedAt === undefined
  ) {
    return null;
  }
  return {
    _model: 'telegram.file',
    byteSize: asNullableNonNegativeInteger(value?.byteSize),
    canRequest: value?.canRequest === true,
    downloadedByteSize: asNullableNonNegativeInteger(value?.downloadedByteSize),
    downloadError: asNullableString(value?.downloadError),
    durationSeconds: asNullableNonNegativeInteger(value?.durationSeconds),
    fileName: asNullableString(value?.fileName),
    height: asNullableNonNegativeInteger(value?.height),
    id,
    mediaKind,
    mimeType: asNullableString(value?.mimeType),
    owner,
    renderKind,
    slotKey,
    status,
    updatedAt,
    url: asNullableString(value?.url),
    width: asNullableNonNegativeInteger(value?.width)
  };
}

export function normalizeFileRefs(value: unknown): FileRef[] {
  return Array.isArray(value)
    ? value
        .map((item) => normalizeFileRef(asRecord(item)))
        .filter(isDefined)
        .sort(compareFileRefs)
    : [];
}

function normalizeFileOwner(value: unknown): FileRef['owner'] | null {
  const owner = asRecord(value);
  const model = asString(owner?._model);
  const id = asString(owner?.id);
  if (id === undefined) {
    return null;
  }
  if (model === 'telegram.activeNotification') {
    return { _model: 'telegram.activeNotification', id };
  }
  if (model === 'telegram.chat') {
    return { _model: 'telegram.chat', id };
  }
  if (model === 'telegram.defaultBackground') {
    return { _model: 'telegram.defaultBackground', id };
  }
  if (model === 'telegram.emojiChatThemes') {
    return { _model: 'telegram.emojiChatThemes', id };
  }
  if (model === 'telegram.message') {
    return { _model: 'telegram.message', id };
  }
  if (model === 'telegram.quickReplyMessage') {
    return { _model: 'telegram.quickReplyMessage', id };
  }
  if (model === 'telegram.stickerSet') {
    return { _model: 'telegram.stickerSet', id };
  }
  if (model === 'telegram.story') {
    return { _model: 'telegram.story', id };
  }
  if (model === 'telegram.user') {
    return { _model: 'telegram.user', id };
  }
  return null;
}

function compareFileRefs(left: FileRef, right: FileRef): number {
  return left.slotKey.localeCompare(right.slotKey);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNullableNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isFileStatus(value: string | undefined): value is FileRef['status'] {
  return (
    value === 'known' ||
    value === 'queued' ||
    value === 'downloading' ||
    value === 'ready' ||
    value === 'failed'
  );
}

function isFileMediaKind(value: string | undefined): value is FileRef['mediaKind'] {
  return (
    value === 'avatar' ||
    value === 'document' ||
    value === 'photo' ||
    value === 'thumbnail' ||
    value === 'video' ||
    value === 'voice'
  );
}

function isFileRenderKind(value: string | undefined): value is FileRef['renderKind'] {
  return value === 'audio' || value === 'download' || value === 'image' || value === 'video';
}
