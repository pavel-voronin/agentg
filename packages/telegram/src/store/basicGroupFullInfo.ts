import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramBasicGroups, telegramChatPhotos, telegramFiles } from '../database/schema.js';
import { tdId, tdJsonObject, tdJsonValue, type UpdateByType } from '../tdlib/shape.js';
import type { file as File } from 'tdlib-types';

type BasicGroupFullInfoUpdate = UpdateByType<'updateBasicGroupFullInfo'>;
type BasicGroupFullInfo = BasicGroupFullInfoUpdate['basic_group_full_info'];
type ChatPhoto = NonNullable<BasicGroupFullInfo['photo']>;

export async function storeBasicGroupFullInfo(
  database: Database,
  basicGroupId: string,
  info: BasicGroupFullInfo
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

async function storeChatPhotoFiles(database: Database, photo: ChatPhoto): Promise<void> {
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

async function storeFile(database: Database, file: File): Promise<void> {
  const row: typeof telegramFiles.$inferInsert = {
    expectedSize: String(file.expected_size),
    id: file.id,
    local: tdJsonObject(file.local),
    remote: tdJsonObject(file.remote),
    size: nullablePositiveId(file.size)
  };

  await database.insert(telegramFiles).values(row).onConflictDoUpdate({
    set: row,
    target: telegramFiles.id
  });
}

async function storeChatPhoto(database: Database, photo: ChatPhoto): Promise<void> {
  const row: typeof telegramChatPhotos.$inferInsert = {
    addedDate: new Date(photo.added_date * 1000),
    animation: requiredJsonValue(photo.animation ?? null),
    id: photo.id,
    minithumbnail: requiredJsonValue(photo.minithumbnail ?? null),
    sizes: requiredJsonValue(photo.sizes),
    smallAnimation: requiredJsonValue(photo.small_animation ?? null),
    sticker: requiredJsonValue(photo.sticker ?? null)
  };

  await database.insert(telegramChatPhotos).values(row).onConflictDoUpdate({
    set: row,
    target: telegramChatPhotos.id
  });
}

function basicGroupFullInfoRow(
  basicGroupId: string,
  info: BasicGroupFullInfo
): typeof telegramBasicGroups.$inferInsert {
  const photo = info.photo ?? null;
  return {
    botCommands: requiredJsonValue(info.bot_commands),
    canHideMembers: info.can_hide_members,
    canToggleAggressiveAntiSpam: info.can_toggle_aggressive_anti_spam,
    creatorUserId: nullableZeroId(info.creator_user_id),
    description: info.description,
    id: basicGroupId,
    inviteLink: tdJsonValue(info.invite_link ?? null) ?? null,
    members: requiredJsonValue(info.members),
    photoId: photo === null ? null : photo.id
  };
}

function chatPhotoFiles(photo: ChatPhoto): File[] {
  const animation = photo.animation ?? null;
  const smallAnimation = photo.small_animation ?? null;

  return [
    ...photo.sizes.map((size) => size.photo),
    ...(animation === null ? [] : [animation.file]),
    ...(smallAnimation === null ? [] : [smallAnimation.file])
  ];
}

function nullableZeroId(value: number | string | null | undefined): string | null {
  const id = tdId(value);
  return id === undefined || id === '0' ? null : id;
}

function nullablePositiveId(value: number): string | null {
  return value > 0 ? String(value) : null;
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
