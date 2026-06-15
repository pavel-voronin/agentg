import type { JsonValue } from '@agentg/framework';
import type { sticker as TdlibSticker } from 'tdlib-types';

import type {
  DomainChange,
  StickerSavedChange,
  StickerSetSavedChange
} from '../../domain/changes.js';
import type { FileState } from '../../domain/models/fileState.js';
import type { Sticker, StickerSet } from '../../domain/models/sticker.js';
import { tdId, tdJsonObject, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import { fileStateFromTdlibFile } from './fileState.js';

type AnimatedEmojiMessageClickedUpdate = UpdateByType<'updateAnimatedEmojiMessageClicked'>;
type TdlibStickerSet = UpdateByType<'updateStickerSet'>['sticker_set'];
type StickerSetUpdate = UpdateByType<'updateStickerSet'>;

export function stickerChanges(update: AnimatedEmojiMessageClickedUpdate): DomainChange[] {
  return [
    {
      kind: 'sticker.saved',
      input: {
        files: stickerFileStatesFromTdlibSticker(update.sticker),
        sticker: stickerRecordFromTdlibSticker(update.sticker)
      }
    } satisfies StickerSavedChange
  ];
}

export function stickerSetChanges(update: StickerSetUpdate): DomainChange[] {
  return [
    {
      kind: 'stickerSet.saved',
      stickerSet: stickerSetRecord(update.sticker_set)
    } satisfies StickerSetSavedChange
  ];
}

export function stickerRecordFromTdlibSticker(sticker: TdlibSticker): Sticker {
  return {
    emoji: sticker.emoji,
    fileId: sticker.sticker.id,
    format: tdJsonObject(sticker.format),
    fullType: tdJsonObject(sticker.full_type),
    height: sticker.height,
    id: nullableZeroId(sticker.id),
    setId: nullableZeroId(sticker.set_id),
    thumbnail: requiredJsonValue(sticker.thumbnail ?? null),
    width: sticker.width
  };
}

export function stickerFileStatesFromTdlibSticker(sticker: TdlibSticker): FileState[] {
  const files = [fileStateFromTdlibFile(sticker.sticker)];
  const thumbnail = sticker.thumbnail ?? null;
  if (thumbnail !== null) {
    files.push(fileStateFromTdlibFile(thumbnail.file));
  }
  return files;
}

function stickerSetRecord(stickerSet: TdlibStickerSet): StickerSet {
  return {
    emojis: requiredJsonValue(stickerSet.emojis),
    id: stickerSet.id,
    isAllowedAsChatEmojiStatus: stickerSet.is_allowed_as_chat_emoji_status,
    isArchived: stickerSet.is_archived,
    isInstalled: stickerSet.is_installed,
    isOfficial: stickerSet.is_official,
    isOwned: stickerSet.is_owned,
    isViewed: stickerSet.is_viewed,
    name: stickerSet.name,
    needsRepainting: stickerSet.needs_repainting,
    stickerType: requiredJsonValue(stickerSet.sticker_type),
    stickers: requiredJsonValue(stickerSet.stickers),
    thumbnail: requiredJsonValue(stickerSet.thumbnail ?? null),
    thumbnailOutline: requiredJsonValue(stickerSet.thumbnail_outline ?? null),
    title: stickerSet.title
  };
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}

function nullableZeroId(value: number | string | null | undefined): string | null {
  const id = tdId(value);
  return id === undefined || id === '0' ? null : id;
}
