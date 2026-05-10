import { createHash } from 'node:crypto';

import type { JsonObject, JsonValue } from '@agentg/events/json';

import { telegramChatRef, telegramMessageRef, telegramMessageModelId } from './model-refs.js';
import type { NormalizedTelegramUpdate } from './normalize.js';
import type {
  ExtractedTelegramFileSlot,
  TelegramFileSource,
  TelegramFileMediaKind,
  TelegramFileRenderKind
} from './telegram-file-types.js';

type TdFileFacts = {
  byteSize: number | null;
  source: TelegramFileSource;
  tdlibFileId: number;
};

type MessageOwner = {
  chatId: string;
  messageId: string;
  ownerId: string;
};

export function extractTelegramFileSlots(
  update: NormalizedTelegramUpdate
): ExtractedTelegramFileSlot[] {
  return [
    ...(update.chat === undefined ? [] : extractChatFileSlots(update.chat.id, update.chat.raw)),
    ...(update.message === undefined
      ? []
      : extractMessageFileSlots(
          {
            chatId: update.message.chatId,
            messageId: update.message.messageId,
            ownerId: telegramMessageModelId(update.message.chatId, update.message.messageId)
          },
          asPlainRecord(update.message.raw.content)
        )),
    ...(update.contentUpdate === undefined
      ? []
      : extractMessageFileSlots(
          {
            chatId: update.contentUpdate.chatId,
            messageId: update.contentUpdate.messageId,
            ownerId: telegramMessageModelId(
              update.contentUpdate.chatId,
              update.contentUpdate.messageId
            )
          },
          asPlainRecord(update.contentUpdate.raw.new_content)
        ))
  ];
}

export function telegramFileSourceFingerprint(source: JsonObject): string {
  return createHash('sha256').update(JSON.stringify(source)).digest('hex');
}

function extractChatFileSlots(chatId: string, raw: JsonObject): ExtractedTelegramFileSlot[] {
  const photo = asPlainRecord(raw.photo);
  return [
    chatAvatarSlot(chatId, 'avatar.small', photo?.small),
    chatAvatarSlot(chatId, 'avatar.big', photo?.big)
  ].filter(isDefined);
}

function chatAvatarSlot(
  chatId: string,
  slotKey: string,
  value: unknown
): ExtractedTelegramFileSlot | undefined {
  const file = tdFileFacts(value);
  if (file === null) {
    return undefined;
  }
  return fileSlot({
    facts: file,
    mediaKind: 'avatar',
    mimeType: 'image/jpeg',
    owner: telegramChatRef(chatId),
    renderKind: 'image',
    slotKey
  });
}

function extractMessageFileSlots(
  owner: MessageOwner,
  content: Record<string, unknown> | undefined
): ExtractedTelegramFileSlot[] {
  switch (content?._) {
    case 'messagePhoto':
      return extractMessagePhotoSlots(owner, content);
    case 'messageVideo':
      return extractMessageVideoSlots(owner, content, 'video');
    case 'messageVideoNote':
      return extractMessageVideoNoteSlots(owner, content);
    case 'messageVoiceNote':
      return extractMessageVoiceNoteSlots(owner, content);
    case 'messageAnimation':
      return extractMessageVideoSlots(owner, content, 'animation');
    case 'messageDocument':
      return extractMessageDocumentSlots(owner, content);
    default:
      return [];
  }
}

function extractMessagePhotoSlots(
  owner: MessageOwner,
  content: Record<string, unknown>
): ExtractedTelegramFileSlot[] {
  const photo = asPlainRecord(content.photo);
  const size = chooseLargestPhotoSize(asRecordArray(photo?.sizes));
  const facts = tdFileFacts(size?.photo);
  if (size === undefined || facts === null) {
    return [];
  }
  return [
    fileSlot({
      facts,
      height: safeInteger(size.height),
      mediaKind: 'photo',
      mimeType: 'image/jpeg',
      owner: telegramMessageRef({ chatId: owner.chatId, messageId: owner.messageId }),
      ownerId: owner.ownerId,
      renderKind: 'image',
      slotKey: 'content.photo.0',
      width: safeInteger(size.width)
    })
  ];
}

function extractMessageVideoSlots(
  owner: MessageOwner,
  content: Record<string, unknown>,
  field: 'animation' | 'video'
): ExtractedTelegramFileSlot[] {
  const video = asPlainRecord(content[field]);
  const slots: ExtractedTelegramFileSlot[] = [];
  const facts = tdFileFacts(video?.[field]);
  if (facts !== null) {
    slots.push(
      fileSlot({
        durationSeconds: safeInteger(video?.duration),
        facts,
        fileName: safeString(video?.file_name),
        height: safeInteger(video?.height),
        mediaKind: 'video',
        mimeType: safeString(video?.mime_type) ?? 'video/mp4',
        owner: telegramMessageRef({ chatId: owner.chatId, messageId: owner.messageId }),
        ownerId: owner.ownerId,
        renderKind: 'video',
        slotKey: 'content.video.file',
        width: safeInteger(video?.width)
      })
    );
  }
  const thumbnail = thumbnailSlot(owner, video?.thumbnail, 'content.video.thumbnail');
  if (thumbnail !== undefined) {
    slots.push(thumbnail);
  }
  return slots;
}

function extractMessageVideoNoteSlots(
  owner: MessageOwner,
  content: Record<string, unknown>
): ExtractedTelegramFileSlot[] {
  const videoNote = asPlainRecord(content.video_note);
  const slots: ExtractedTelegramFileSlot[] = [];
  const facts = tdFileFacts(videoNote?.video);
  if (facts !== null) {
    slots.push(
      fileSlot({
        durationSeconds: safeInteger(videoNote?.duration),
        facts,
        height: safeInteger(videoNote?.length),
        mediaKind: 'video',
        mimeType: 'video/mp4',
        owner: telegramMessageRef({ chatId: owner.chatId, messageId: owner.messageId }),
        ownerId: owner.ownerId,
        renderKind: 'video',
        slotKey: 'content.video.file',
        width: safeInteger(videoNote?.length)
      })
    );
  }
  const thumbnail = thumbnailSlot(owner, videoNote?.thumbnail, 'content.video.thumbnail');
  if (thumbnail !== undefined) {
    slots.push(thumbnail);
  }
  return slots;
}

function extractMessageDocumentSlots(
  owner: MessageOwner,
  content: Record<string, unknown>
): ExtractedTelegramFileSlot[] {
  const document = asPlainRecord(content.document);
  const slots: ExtractedTelegramFileSlot[] = [];
  const facts = tdFileFacts(document?.document);
  if (facts !== null) {
    slots.push(
      fileSlot({
        facts,
        fileName: safeString(document?.file_name),
        mediaKind: 'document',
        mimeType: safeString(document?.mime_type),
        owner: telegramMessageRef({ chatId: owner.chatId, messageId: owner.messageId }),
        ownerId: owner.ownerId,
        renderKind: 'download',
        slotKey: 'content.document.file'
      })
    );
  }
  const thumbnail = thumbnailSlot(owner, document?.thumbnail, 'content.document.thumbnail');
  if (thumbnail !== undefined) {
    slots.push(thumbnail);
  }
  return slots;
}

function extractMessageVoiceNoteSlots(
  owner: MessageOwner,
  content: Record<string, unknown>
): ExtractedTelegramFileSlot[] {
  const voiceNote = asPlainRecord(content.voice_note);
  const facts = tdFileFacts(voiceNote?.voice);
  if (facts === null) {
    return [];
  }
  return [
    fileSlot({
      durationSeconds: safeInteger(voiceNote?.duration),
      facts,
      mediaKind: 'voice',
      mimeType: safeString(voiceNote?.mime_type) ?? 'audio/ogg',
      owner: telegramMessageRef({ chatId: owner.chatId, messageId: owner.messageId }),
      ownerId: owner.ownerId,
      renderKind: 'audio',
      slotKey: 'content.voice.file'
    })
  ];
}

function thumbnailSlot(
  owner: MessageOwner,
  value: unknown,
  slotKey: string
): ExtractedTelegramFileSlot | undefined {
  const thumbnail = asPlainRecord(value);
  const facts = tdFileFacts(thumbnail?.file);
  if (facts === null) {
    return undefined;
  }
  return fileSlot({
    facts,
    height: safeInteger(thumbnail?.height),
    mediaKind: 'thumbnail',
    mimeType: 'image/jpeg',
    owner: telegramMessageRef({ chatId: owner.chatId, messageId: owner.messageId }),
    ownerId: owner.ownerId,
    renderKind: 'image',
    slotKey,
    width: safeInteger(thumbnail?.width)
  });
}

function fileSlot(input: {
  durationSeconds?: number | null;
  facts: TdFileFacts;
  fileName?: string | null;
  height?: number | null;
  mediaKind: TelegramFileMediaKind;
  mimeType?: string | null;
  owner: ExtractedTelegramFileSlot['owner'];
  ownerId?: string;
  renderKind: TelegramFileRenderKind;
  slotKey: string;
  width?: number | null;
}): ExtractedTelegramFileSlot {
  return {
    byteSize: input.facts.byteSize,
    durationSeconds: input.durationSeconds ?? null,
    fileName: input.fileName ?? null,
    height: input.height ?? null,
    mediaKind: input.mediaKind,
    mimeType: input.mimeType ?? null,
    owner: input.owner,
    renderKind: input.renderKind,
    slotKey: input.slotKey,
    source: input.facts.source,
    tdlibFileId: input.facts.tdlibFileId,
    width: input.width ?? null
  };
}

function tdFileFacts(value: unknown): TdFileFacts | null {
  const file = asPlainRecord(value);
  const fileId = safeInteger(file?.id);
  if (file === undefined || fileId === null) {
    return null;
  }

  const local = asPlainRecord(file.local);
  const remote = asPlainRecord(file.remote);
  const source = compactJsonObject({
    kind: 'tdlibFile',
    fileId,
    localPath: safeString(local?.path),
    remoteId: safeString(remote?.id),
    remoteUniqueId: safeString(remote?.unique_id)
  }) as TelegramFileSource;
  const localDownloadedSize = safePositiveInteger(local?.downloaded_size);
  return {
    byteSize:
      safePositiveInteger(file.size) ??
      safePositiveInteger(file.expected_size) ??
      (local?.is_downloading_completed === true ? localDownloadedSize : null) ??
      null,
    source,
    tdlibFileId: fileId
  };
}

function chooseLargestPhotoSize(
  sizes: Record<string, unknown>[]
): Record<string, unknown> | undefined {
  return [...sizes].sort((left, right) => photoSizeScore(right) - photoSizeScore(left))[0];
}

function photoSizeScore(size: Record<string, unknown>): number {
  const photo = asPlainRecord(size.photo);
  return (
    (safeInteger(size.width) ?? 0) * (safeInteger(size.height) ?? 0) +
    (safePositiveInteger(photo?.size) ?? safePositiveInteger(photo?.expected_size) ?? 0)
  );
}

function compactJsonObject(value: Record<string, JsonValue | undefined>): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, JsonValue] => entry[1] !== undefined)
  );
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asPlainRecord).filter(isDefined) : [];
}

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function safeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

function safePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
