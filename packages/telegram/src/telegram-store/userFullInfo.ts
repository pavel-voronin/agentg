import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database.js';
import { telegramChatPhotos, telegramFiles, telegramUsers } from '../schema.js';
import {
  telegramWireDate,
  telegramWireId,
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireFile,
  type TelegramWireUpdateByType
} from '../telegramWire.js';

type TelegramWireUserFullInfoUpdate = TelegramWireUpdateByType<'updateUserFullInfo'>;
type TelegramWireUserFullInfo = TelegramWireUserFullInfoUpdate['user_full_info'];
type TelegramWireChatPhoto = NonNullable<TelegramWireUserFullInfo['photo']>;

export async function storeUserFullInfo(
  database: TelegramDatabase,
  userId: string,
  info: TelegramWireUserFullInfo
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

function userFullInfoRow(
  userId: string,
  info: TelegramWireUserFullInfo
): typeof telegramUsers.$inferInsert {
  return {
    bio: nullableTelegramWireJsonValue(info.bio ?? null),
    birthdate: nullableTelegramWireJsonValue(info.birthdate ?? null),
    blockList: nullableTelegramWireJsonValue(info.block_list ?? null),
    botInfo: nullableTelegramWireJsonValue(info.bot_info ?? null),
    botVerification: nullableTelegramWireJsonValue(info.bot_verification ?? null),
    businessInfo: nullableTelegramWireJsonValue(info.business_info ?? null),
    canBeCalled: info.can_be_called,
    firstProfileAudio: nullableTelegramWireJsonValue(info.first_profile_audio ?? null),
    giftCount: info.gift_count,
    giftSettings: requiredTelegramWireJsonValue(info.gift_settings),
    groupInCommonCount: info.group_in_common_count,
    hasPostedToProfileStories: info.has_posted_to_profile_stories,
    hasPrivateCalls: info.has_private_calls,
    hasPrivateForwards: info.has_private_forwards,
    hasRestrictedVoiceAndVideoNoteMessages: info.has_restricted_voice_and_video_note_messages,
    hasSponsoredMessagesEnabled: info.has_sponsored_messages_enabled,
    id: userId,
    incomingPaidMessageStarCount: String(info.incoming_paid_message_star_count),
    mainProfileTab: nullableTelegramWireJsonValue(info.main_profile_tab ?? null),
    needPhoneNumberPrivacyException: info.need_phone_number_privacy_exception,
    note: nullableTelegramWireJsonValue(info.note ?? null),
    outgoingPaidMessageStarCount: String(info.outgoing_paid_message_star_count),
    pendingRating: nullableTelegramWireJsonValue(info.pending_rating ?? null),
    pendingRatingDate: nullableTelegramWireDate(info.pending_rating_date),
    personalChatId: nullableZeroId(info.personal_chat_id),
    personalPhotoId: chatPhotoReferenceId(info.personal_photo ?? null),
    photoId: chatPhotoReferenceId(info.photo ?? null),
    publicPhotoId: chatPhotoReferenceId(info.public_photo ?? null),
    rating: nullableTelegramWireJsonValue(info.rating ?? null),
    setChatBackground: info.set_chat_background,
    supportsVideoCalls: info.supports_video_calls,
    usesUnofficialApp: info.uses_unofficial_app
  };
}

function userFullInfoChatPhotos(info: TelegramWireUserFullInfo): TelegramWireChatPhoto[] {
  return [info.personal_photo ?? null, info.photo ?? null, info.public_photo ?? null].filter(
    (photo): photo is TelegramWireChatPhoto => photo !== null
  );
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

function chatPhotoReferenceId(photo: TelegramWireChatPhoto | null): string | null {
  return nullableZeroId(photo?.id);
}

function nullableTelegramWireDate(value: number): Date | null {
  return telegramWireDate(value) ?? null;
}

function nullableZeroId(value: number | string | null | undefined): string | null {
  const id = telegramWireId(value);
  return id === undefined || id === '0' ? null : id;
}

function nullablePositiveId(value: number): string | null {
  return value > 0 ? String(value) : null;
}

function nullableTelegramWireJsonValue(value: unknown): JsonValue | null {
  return telegramWireJsonValue(value ?? null) ?? null;
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
