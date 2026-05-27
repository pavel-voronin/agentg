import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database.js';
import { telegramBasicGroups, telegramChatPhotos, telegramFiles } from '../schema.js';
import {
  telegramWireId,
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireFile,
  type TelegramWireUpdateByType
} from '../telegramWire.js';

type TelegramWireBasicGroupFullInfoUpdate = TelegramWireUpdateByType<'updateBasicGroupFullInfo'>;
type TelegramWireBasicGroupFullInfo = TelegramWireBasicGroupFullInfoUpdate['basic_group_full_info'];
type TelegramWireChatPhoto = NonNullable<TelegramWireBasicGroupFullInfo['photo']>;

export async function storeBasicGroupFullInfo(
  database: TelegramDatabase,
  basicGroupId: string,
  info: TelegramWireBasicGroupFullInfo
): Promise<void> {
  const photo = info.photo ?? null;
  if (photo !== null) {
    await storeChatPhotoFiles(database, photo);
    await storeChatPhoto(database, photo);
  }

  const row = basicGroupFullInfoRow(basicGroupId, info);
  await database.insert(telegramBasicGroups).values(row).onConflictDoUpdate({
    set: row,
    target: telegramBasicGroups.id
  });
}

async function storeChatPhotoFiles(
  database: TelegramDatabase,
  photo: TelegramWireChatPhoto
): Promise<void> {
  const files = chatPhotoFiles(photo);
  const storedFileIds = new Set<number>();

  for (const file of files) {
    if (storedFileIds.has(file.id)) {
      continue;
    }
    storedFileIds.add(file.id);
    await storeFile(database, file);
  }
}

async function storeFile(database: TelegramDatabase, file: TelegramWireFile): Promise<void> {
  const row: typeof telegramFiles.$inferInsert = {
    expectedSize: String(file.expected_size),
    id: file.id,
    local: telegramWireJsonObject(file.local),
    remote: telegramWireJsonObject(file.remote),
    size: nullablePositiveId(file.size)
  };

  await database.insert(telegramFiles).values(row).onConflictDoUpdate({
    set: row,
    target: telegramFiles.id
  });
}

async function storeChatPhoto(
  database: TelegramDatabase,
  photo: TelegramWireChatPhoto
): Promise<void> {
  const row: typeof telegramChatPhotos.$inferInsert = {
    addedDate: new Date(photo.added_date * 1000),
    animation: requiredTelegramWireJsonValue(photo.animation ?? null),
    id: photo.id,
    minithumbnail: requiredTelegramWireJsonValue(photo.minithumbnail ?? null),
    sizes: requiredTelegramWireJsonValue(photo.sizes),
    smallAnimation: requiredTelegramWireJsonValue(photo.small_animation ?? null),
    sticker: requiredTelegramWireJsonValue(photo.sticker ?? null)
  };

  await database.insert(telegramChatPhotos).values(row).onConflictDoUpdate({
    set: row,
    target: telegramChatPhotos.id
  });
}

function basicGroupFullInfoRow(
  basicGroupId: string,
  info: TelegramWireBasicGroupFullInfo
): typeof telegramBasicGroups.$inferInsert {
  const photo = info.photo ?? null;
  return {
    botCommands: requiredTelegramWireJsonValue(info.bot_commands),
    canHideMembers: info.can_hide_members,
    canToggleAggressiveAntiSpam: info.can_toggle_aggressive_anti_spam,
    creatorUserId: nullableZeroId(info.creator_user_id),
    description: info.description,
    id: basicGroupId,
    inviteLink: telegramWireJsonValue(info.invite_link ?? null) ?? null,
    members: requiredTelegramWireJsonValue(info.members),
    photoId: photo === null ? null : photo.id
  };
}

function chatPhotoFiles(photo: TelegramWireChatPhoto): TelegramWireFile[] {
  const animation = photo.animation ?? null;
  const smallAnimation = photo.small_animation ?? null;

  return [
    ...photo.sizes.map((size) => size.photo),
    ...(animation === null ? [] : [animation.file]),
    ...(smallAnimation === null ? [] : [smallAnimation.file])
  ];
}

function nullableZeroId(value: number | string | null | undefined): string | null {
  const id = telegramWireId(value);
  return id === undefined || id === '0' ? null : id;
}

function nullablePositiveId(value: number): string | null {
  return value > 0 ? String(value) : null;
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
