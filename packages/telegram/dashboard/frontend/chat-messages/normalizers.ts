import type {
  FileRef,
  Message,
  MessageServiceAction,
  MessageTextEntity
} from '../../../src/domain/models/message.js';
import { normalizeFileRefs } from '../fileRefs.js';
import type { MessageDeletion, MessageUpdate } from './types.js';

export function readMessages(value: unknown): Message[] {
  return Array.isArray(value)
    ? value.map((item) => normalizeMessage(asRecord(item))).filter(isDefined)
    : [];
}

export function normalizeMessage(value: Record<string, unknown> | undefined): Message | null {
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

function normalizeMessageMedia(value: unknown): Message['media'] {
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

function normalizeMessageReactions(value: unknown): Message['reactions'] {
  return asArray(value).map(normalizeMessageReaction).filter(isDefined);
}

function normalizeMessageReaction(
  value: Record<string, unknown>
): Message['reactions'][number] | undefined {
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

function normalizeReply(value: unknown): Message['replyTo'] {
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

function normalizeSender(value: unknown): Message['sender'] {
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

function asNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isSafeLinkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
