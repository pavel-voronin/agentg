import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramChatPhotos, telegramFiles, telegramUsers } from '../database/schema.js';
import { tdDate, tdId, tdJsonObject, tdJsonValue, type UpdateByType } from '../tdlib/value.js';
import type { file as File } from 'tdlib-types';

type UserFullInfoUpdate = UpdateByType<'updateUserFullInfo'>;
type UserFullInfo = UserFullInfoUpdate['user_full_info'];
type ChatPhoto = NonNullable<UserFullInfo['photo']>;

export async function storeUserFullInfo(
  database: Database,
  userId: string,
  info: UserFullInfo
): Promise<void> {
  const photos = userFullInfoChatPhotos(info);
  const storedPhotoIds = new Set<string>();

  for (const photo of photos) {
    if (storedPhotoIds.has(photo.id)) {
      continue;
    }
    storedPhotoIds.add(photo.id);
    await storeChatPhotoFiles(database, photo);
    await storeChatPhoto(database, photo);
  }

  const row = userFullInfoRow(userId, info);
  await database.insert(telegramUsers).values(row).onConflictDoUpdate({
    set: row,
    target: telegramUsers.id
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

function userFullInfoRow(userId: string, info: UserFullInfo): typeof telegramUsers.$inferInsert {
  return {
    bio: nullableJsonValue(info.bio ?? null),
    birthdate: nullableJsonValue(info.birthdate ?? null),
    blockList: nullableJsonValue(info.block_list ?? null),
    botInfo: nullableJsonValue(info.bot_info ?? null),
    botVerification: nullableJsonValue(info.bot_verification ?? null),
    businessInfo: nullableJsonValue(info.business_info ?? null),
    canBeCalled: info.can_be_called,
    firstProfileAudio: nullableJsonValue(info.first_profile_audio ?? null),
    giftCount: info.gift_count,
    giftSettings: requiredJsonValue(info.gift_settings),
    groupInCommonCount: info.group_in_common_count,
    hasPostedToProfileStories: info.has_posted_to_profile_stories,
    hasPrivateCalls: info.has_private_calls,
    hasPrivateForwards: info.has_private_forwards,
    hasRestrictedVoiceAndVideoNoteMessages: info.has_restricted_voice_and_video_note_messages,
    hasSponsoredMessagesEnabled: info.has_sponsored_messages_enabled,
    id: userId,
    incomingPaidMessageStarCount: String(info.incoming_paid_message_star_count),
    mainProfileTab: nullableJsonValue(info.main_profile_tab ?? null),
    needPhoneNumberPrivacyException: info.need_phone_number_privacy_exception,
    note: nullableJsonValue(info.note ?? null),
    outgoingPaidMessageStarCount: String(info.outgoing_paid_message_star_count),
    pendingRating: nullableJsonValue(info.pending_rating ?? null),
    pendingRatingDate: nullableDate(info.pending_rating_date),
    personalChatId: nullableZeroId(info.personal_chat_id),
    personalPhotoId: chatPhotoReferenceId(info.personal_photo ?? null),
    photoId: chatPhotoReferenceId(info.photo ?? null),
    publicPhotoId: chatPhotoReferenceId(info.public_photo ?? null),
    rating: nullableJsonValue(info.rating ?? null),
    setChatBackground: info.set_chat_background,
    supportsVideoCalls: info.supports_video_calls,
    usesUnofficialApp: info.uses_unofficial_app
  };
}

function userFullInfoChatPhotos(info: UserFullInfo): ChatPhoto[] {
  return [info.personal_photo ?? null, info.photo ?? null, info.public_photo ?? null].filter(
    (photo): photo is ChatPhoto => photo !== null
  );
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

function chatPhotoReferenceId(photo: ChatPhoto | null): string | null {
  return nullableZeroId(photo?.id);
}

function nullableDate(value: number): Date | null {
  return tdDate(value) ?? null;
}

function nullableZeroId(value: number | string | null | undefined): string | null {
  const id = tdId(value);
  return id === undefined || id === '0' ? null : id;
}

function nullablePositiveId(value: number): string | null {
  return value > 0 ? String(value) : null;
}

function nullableJsonValue(value: unknown): JsonValue | null {
  return tdJsonValue(value ?? null) ?? null;
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
