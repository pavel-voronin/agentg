import type {
  FileRef,
  MessageServiceAction,
  MessageTextEntity,
  ReadMessage
} from '../../../src/views/schemas.js';
import type { MessageDeletion, MessageUpdate } from './types.js';

export function readMessages(value: unknown): ReadMessage[] {
  return Array.isArray(value)
    ? value.map((item) => normalizeMessage(asRecord(item))).filter(isDefined)
    : [];
}

export function normalizeMessage(value: Record<string, unknown> | undefined): ReadMessage | null {
  const id = asString(value?.id);
  const chat = asRecord(value?.chat);
  const chatId = asString(chat?.id);
  const contentType = asString(value?.contentType);
  const telegramMessageId = asString(value?.telegramMessageId);
  if (
    id === undefined ||
    chatId === undefined ||
    contentType === undefined ||
    telegramMessageId === undefined
  ) {
    return null;
  }

  return {
    _model: 'telegram.message',
    chat: {
      _model: 'telegram.chat',
      id: chatId
    },
    contentType,
    deletedAt: asNullableString(value?.deletedAt),
    editDate: asNullableString(value?.editDate),
    id,
    isDeleted: value?.isDeleted === true,
    isOutgoing: value?.isOutgoing === true,
    media: normalizeMessageMedia(value?.media),
    messageDate: asNullableString(value?.messageDate),
    reactions: normalizeMessageReactions(value?.reactions),
    replyTo: normalizeReply(value?.replyTo),
    sender: normalizeSender(value?.sender),
    senderDisplayName: asNullableString(value?.senderDisplayName),
    senderType: asNullableString(value?.senderType),
    serviceAction: normalizeServiceAction(value?.serviceAction),
    telegramMessageId,
    text: asNullableString(value?.text),
    textEntities: normalizeTextEntities(value?.textEntities)
  };
}

export function normalizeMessageUpdate(
  value: Record<string, unknown> | undefined
): MessageUpdate | null {
  const chatId = asString(asRecord(value?.chat)?.id);
  const contentType = asString(value?.contentType);
  const messageId = asString(value?.telegramMessageId);
  if (chatId === undefined || contentType === undefined || messageId === undefined) {
    return null;
  }
  return {
    chatId,
    contentType,
    editDate: asNullableString(value?.editDate),
    mediaFiles: normalizeOptionalMessageMedia(value?.media),
    messageId,
    reactions: normalizeMessageReactions(value?.reactions),
    serviceAction: normalizeServiceAction(value?.serviceAction),
    text: asNullableString(value?.text),
    textEntities: normalizeTextEntities(value?.textEntities)
  };
}

export function normalizeMessageDeletion(value: unknown): MessageDeletion | null {
  const deletion = asRecord(value);
  const chatId = asString(asRecord(deletion?.chat)?.id);
  if (chatId === undefined) {
    return null;
  }
  const messageIds = new Set(
    asArray(deletion?.messages)
      .map((message) => asString(message.id))
      .filter(isDefined)
  );
  if (messageIds.size === 0) {
    return null;
  }

  return {
    chatId,
    deletedAt: asNullableString(deletion?.deletedAt),
    messageIds
  };
}

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

export function normalizeDecisionReason(value: unknown): string | null {
  const decision = asRecord(value);
  return decision?.action === 'deny' ? (asString(decision.reason) ?? 'File request denied') : null;
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeMessageMedia(value: unknown): ReadMessage['media'] {
  return {
    files: normalizeFileRefs(asRecord(value)?.files)
  };
}

function normalizeOptionalMessageMedia(value: unknown): FileRef[] | null {
  if (value === undefined) {
    return null;
  }
  return normalizeMessageMedia(value).files;
}

function normalizeMessageReactions(value: unknown): ReadMessage['reactions'] {
  return asArray(value).map(normalizeMessageReaction).filter(isDefined);
}

function normalizeMessageReaction(
  value: Record<string, unknown>
): ReadMessage['reactions'][number] | undefined {
  const reactionType = asString(value.reactionType);
  const totalCount = asNonNegativeInteger(value.totalCount);
  if (reactionType === undefined || totalCount === undefined) {
    return undefined;
  }
  return {
    isChosen: value.isChosen === true,
    reactionType,
    recentSenderIds: asUnknownArray(value.recentSenderIds),
    totalCount,
    usedSenderId: value.usedSenderId ?? null
  };
}

function normalizeFileRefs(value: unknown): FileRef[] {
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
  if (model === 'telegram.chat') {
    return { _model: 'telegram.chat', id };
  }
  if (model === 'telegram.message') {
    return { _model: 'telegram.message', id };
  }
  if (model === 'telegram.emojiChatThemes') {
    return { _model: 'telegram.emojiChatThemes', id };
  }
  return null;
}

function normalizeTextEntities(value: unknown): MessageTextEntity[] {
  return asArray(value).map(normalizeTextEntity).filter(isDefined);
}

function normalizeTextEntity(value: Record<string, unknown>): MessageTextEntity | undefined {
  const kind = value.kind;
  const offset = value.offset;
  const length = value.length;
  const url = asString(value.url);
  if (
    (kind !== 'url' && kind !== 'textUrl') ||
    typeof offset !== 'number' ||
    typeof length !== 'number' ||
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length <= 0 ||
    url === undefined ||
    !isSafeLinkUrl(url)
  ) {
    return undefined;
  }
  return {
    kind,
    length,
    offset,
    url
  };
}

function normalizeReply(value: unknown): ReadMessage['replyTo'] {
  const reply = asRecord(value);
  const chatId = asString(asRecord(reply?.chat)?.id);
  const messageId = asString(reply?.telegramMessageId);
  const modelId = asString(asRecord(reply?.message)?.id);
  if (chatId === undefined || messageId === undefined || modelId === undefined) {
    return null;
  }
  return {
    chat: {
      _model: 'telegram.chat',
      id: chatId
    },
    message: {
      _model: 'telegram.message',
      id: modelId
    },
    telegramMessageId: messageId
  };
}

function normalizeServiceAction(value: unknown): MessageServiceAction | null {
  const action = asRecord(value);
  if (action?.kind !== 'chatMemberLeft') {
    return null;
  }

  const userId = asString(asRecord(action.user)?.id);
  if (userId === undefined) {
    return null;
  }

  return {
    kind: 'chatMemberLeft',
    user: {
      _model: 'telegram.user',
      id: userId
    },
    userDisplayName: asNullableString(action.userDisplayName) ?? userId
  };
}

function normalizeSender(value: unknown): ReadMessage['sender'] {
  const sender = asRecord(value);
  const model = asString(sender?._model);
  const id = asString(sender?.id);
  if (id === undefined) {
    return null;
  }
  if (model === 'telegram.chat') {
    return {
      _model: 'telegram.chat',
      id
    };
  }
  if (model === 'telegram.user') {
    return {
      _model: 'telegram.user',
      id
    };
  }
  return null;
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is Record<string, unknown> => item !== undefined)
    : [];
}

function asUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNullableNonNegativeInteger(value: unknown): number | null {
  return asNonNegativeInteger(value) ?? null;
}

function asNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
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

function compareFileRefs(left: FileRef, right: FileRef): number {
  return left.slotKey.localeCompare(right.slotKey);
}

function isSafeLinkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
