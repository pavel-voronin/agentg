import { eq } from 'drizzle-orm';

import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database.js';
import { telegramChatPhotos, telegramFiles, telegramSupergroups } from '../schema.js';
import {
  telegramWireId,
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireFile,
  type TelegramWireSupergroupFullInfoUpdate
} from '../telegramWire.js';

type TelegramWireSupergroupFullInfo = TelegramWireSupergroupFullInfoUpdate['supergroup_full_info'];
type TelegramWireChatPhoto = NonNullable<TelegramWireSupergroupFullInfo['photo']>;

export async function storeSupergroupFullInfo(
  database: TelegramDatabase,
  supergroupId: string,
  info: TelegramWireSupergroupFullInfo
): Promise<void> {
  const photo = info.photo ?? null;
  if (photo !== null) {
    await storeChatPhotoFiles(database, photo);
    await storeChatPhoto(database, photo);
  }

  const updated = await database
    .update(telegramSupergroups)
    .set(supergroupFullInfoRow(supergroupId, info))
    .where(eq(telegramSupergroups.id, supergroupId))
    .returning({
      id: telegramSupergroups.id
    });

  if (updated.length === 0) {
    throw new Error(`Telegram supergroup row was not found: ${supergroupId}`);
  }
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

function supergroupFullInfoRow(
  supergroupId: string,
  info: TelegramWireSupergroupFullInfo
): Partial<typeof telegramSupergroups.$inferInsert> {
  const photo = info.photo ?? null;
  return {
    administratorCount: info.administrator_count,
    bannedCount: info.banned_count,
    botCommands: requiredTelegramWireJsonValue(info.bot_commands),
    botVerification: telegramWireJsonValue(info.bot_verification ?? null) ?? null,
    canEnablePaidMessages: info.can_enable_paid_messages,
    canEnablePaidReaction: info.can_enable_paid_reaction,
    canGetMembers: info.can_get_members,
    canGetRevenueStatistics: info.can_get_revenue_statistics,
    canGetStarRevenueStatistics: info.can_get_star_revenue_statistics,
    canGetStatistics: info.can_get_statistics,
    canHaveSponsoredMessages: info.can_have_sponsored_messages,
    canHideMembers: info.can_hide_members,
    canSendGift: info.can_send_gift,
    canSetLocation: info.can_set_location,
    canSetStickerSet: info.can_set_sticker_set,
    canToggleAggressiveAntiSpam: info.can_toggle_aggressive_anti_spam,
    customEmojiStickerSetId: nullableZeroId(info.custom_emoji_sticker_set_id),
    description: info.description,
    directMessagesChatId: nullableZeroId(info.direct_messages_chat_id),
    giftCount: info.gift_count,
    hasAggressiveAntiSpamEnabled: info.has_aggressive_anti_spam_enabled,
    hasHiddenMembers: info.has_hidden_members,
    hasPaidMediaAllowed: info.has_paid_media_allowed,
    hasPinnedStories: info.has_pinned_stories,
    id: supergroupId,
    inviteLink: telegramWireJsonValue(info.invite_link ?? null) ?? null,
    isAllHistoryAvailable: info.is_all_history_available,
    linkedChatId: nullableZeroId(info.linked_chat_id),
    location: telegramWireJsonValue(info.location ?? null) ?? null,
    mainProfileTab: telegramWireJsonValue(info.main_profile_tab ?? null) ?? null,
    memberCount: info.member_count,
    myBoostCount: info.my_boost_count,
    outgoingPaidMessageStarCount: telegramWireId(info.outgoing_paid_message_star_count),
    photoId: photo === null ? null : photo.id,
    restrictedCount: info.restricted_count,
    slowModeDelay: info.slow_mode_delay,
    slowModeDelayExpiresIn: info.slow_mode_delay_expires_in,
    stickerSetId: nullableZeroId(info.sticker_set_id),
    unrestrictBoostCount: info.unrestrict_boost_count,
    upgradedFromBasicGroupId: nullableZeroId(info.upgraded_from_basic_group_id),
    upgradedFromMaxMessageId: nullableZeroId(info.upgraded_from_max_message_id)
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
