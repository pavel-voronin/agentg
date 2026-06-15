import { eq } from 'drizzle-orm';

import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramChatPhotos, telegramFiles, telegramSupergroups } from '../database/schema.js';
import { tdId, tdJsonObject, tdJsonValue } from '../tdlib/shape.js';
import type {
  file as File,
  updateSupergroupFullInfo as SupergroupFullInfoUpdate
} from 'tdlib-types';

type SupergroupFullInfo = SupergroupFullInfoUpdate['supergroup_full_info'];
type ChatPhoto = NonNullable<SupergroupFullInfo['photo']>;

export async function storeSupergroupFullInfo(
  database: Database,
  supergroupId: string,
  info: SupergroupFullInfo
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

function supergroupFullInfoRow(
  supergroupId: string,
  info: SupergroupFullInfo
): Partial<typeof telegramSupergroups.$inferInsert> {
  const photo = info.photo ?? null;
  return {
    administratorCount: info.administrator_count,
    bannedCount: info.banned_count,
    botCommands: requiredJsonValue(info.bot_commands),
    botVerification: tdJsonValue(info.bot_verification ?? null) ?? null,
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
    inviteLink: tdJsonValue(info.invite_link ?? null) ?? null,
    isAllHistoryAvailable: info.is_all_history_available,
    linkedChatId: nullableZeroId(info.linked_chat_id),
    location: tdJsonValue(info.location ?? null) ?? null,
    mainProfileTab: tdJsonValue(info.main_profile_tab ?? null) ?? null,
    memberCount: info.member_count,
    myBoostCount: info.my_boost_count,
    outgoingPaidMessageStarCount: tdId(info.outgoing_paid_message_star_count),
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
