import type { JsonValue } from '@agentg/framework';

import type {
  BasicGroupFullInfoSavedChange,
  BasicGroupSavedChange,
  DomainChange,
  SupergroupFullInfoSavedChange,
  SupergroupSavedChange
} from '../../domain/changes.js';
import type { ChatPhoto } from '../../domain/models/chatPhoto.js';
import type { FileState } from '../../domain/models/fileState.js';
import type { BasicGroup, Supergroup, SupergroupPatch } from '../../domain/models/group.js';
import { tdId, tdJsonObject, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import {
  chatPhotoFromTdlibChatPhoto,
  fileStatesFromTdlibChatPhoto,
  type TdlibChatPhotoSource
} from './chatPhoto.js';

type BasicGroupUpdate = UpdateByType<'updateBasicGroup'>;
type TdlibBasicGroup = BasicGroupUpdate['basic_group'];
type BasicGroupFullInfoUpdate = UpdateByType<'updateBasicGroupFullInfo'>;
type BasicGroupFullInfo = BasicGroupFullInfoUpdate['basic_group_full_info'];
type SupergroupUpdate = UpdateByType<'updateSupergroup'>;
type TdlibSupergroup = SupergroupUpdate['supergroup'];
type SupergroupFullInfoUpdate = UpdateByType<'updateSupergroupFullInfo'>;
type SupergroupFullInfo = SupergroupFullInfoUpdate['supergroup_full_info'];

export function basicGroupChanges(update: BasicGroupUpdate): DomainChange[] {
  return [
    {
      kind: 'basicGroup.saved',
      group: basicGroupRecordFromTdlibBasicGroup(update.basic_group)
    } satisfies BasicGroupSavedChange
  ];
}

export function basicGroupFullInfoChanges(update: BasicGroupFullInfoUpdate): DomainChange[] {
  const photo = update.basic_group_full_info.photo ?? null;
  return [
    {
      kind: 'basicGroup.fullInfoSaved',
      info: {
        chatPhotos: chatPhotoModels(photo),
        files: fileStates(photo),
        group: basicGroupFullInfo(String(update.basic_group_id), update.basic_group_full_info)
      }
    } satisfies BasicGroupFullInfoSavedChange
  ];
}

export function supergroupChanges(update: SupergroupUpdate): DomainChange[] {
  return [
    {
      kind: 'supergroup.saved',
      group: supergroupRecordFromTdlibSupergroup(update.supergroup)
    } satisfies SupergroupSavedChange
  ];
}

export function supergroupFullInfoChanges(update: SupergroupFullInfoUpdate): DomainChange[] {
  const photo = update.supergroup_full_info.photo ?? null;
  return [
    {
      kind: 'supergroup.fullInfoSaved',
      info: {
        chatPhotos: chatPhotoModels(photo),
        files: fileStates(photo),
        group: supergroupFullInfoRecord(String(update.supergroup_id), update.supergroup_full_info)
      }
    } satisfies SupergroupFullInfoSavedChange
  ];
}

function basicGroupRecordFromTdlibBasicGroup(group: TdlibBasicGroup): BasicGroup {
  return {
    id: String(group.id),
    isActive: group.is_active,
    memberCount: group.member_count,
    status: tdJsonObject(group.status),
    upgradedToSupergroupId: nullableZeroId(group.upgraded_to_supergroup_id)
  };
}

function basicGroupFullInfo(basicGroupId: string, info: BasicGroupFullInfo): BasicGroup {
  const photo = info.photo ?? null;
  return {
    botCommands: requiredJsonValue(info.bot_commands),
    canHideMembers: info.can_hide_members,
    canToggleAggressiveAntiSpam: info.can_toggle_aggressive_anti_spam,
    creatorUserId: nullableZeroId(info.creator_user_id),
    description: info.description,
    id: basicGroupId,
    inviteLink: nullableJsonValue(info.invite_link),
    members: requiredJsonValue(info.members),
    photoId: photo === null ? null : photo.id
  };
}

function supergroupRecordFromTdlibSupergroup(group: TdlibSupergroup): Supergroup {
  return {
    activeStoryState: nullableJsonValue(group.active_story_state),
    boostLevel: group.boost_level,
    date: new Date(group.date * 1000),
    hasAutomaticTranslation: group.has_automatic_translation,
    hasDirectMessagesGroup: group.has_direct_messages_group,
    hasForumTabs: group.has_forum_tabs,
    hasLinkedChat: group.has_linked_chat,
    hasLocation: group.has_location,
    id: String(group.id),
    isAdministeredDirectMessagesGroup: group.is_administered_direct_messages_group,
    isBroadcastGroup: group.is_broadcast_group,
    isChannel: group.is_channel,
    isDirectMessagesGroup: group.is_direct_messages_group,
    isForum: group.is_forum,
    isSlowModeEnabled: group.is_slow_mode_enabled,
    joinByRequest: group.join_by_request,
    joinToSendMessages: group.join_to_send_messages,
    memberCount: group.member_count,
    paidMessageStarCount: String(group.paid_message_star_count),
    restrictionInfo: nullableJsonValue(group.restriction_info),
    showMessageSender: group.show_message_sender,
    signMessages: group.sign_messages,
    status: tdJsonObject(group.status),
    usernames: nullableJsonValue(group.usernames),
    verificationStatus: nullableJsonValue(group.verification_status)
  };
}

function supergroupFullInfoRecord(supergroupId: string, info: SupergroupFullInfo): SupergroupPatch {
  const photo = info.photo ?? null;
  return {
    administratorCount: info.administrator_count,
    bannedCount: info.banned_count,
    botCommands: requiredJsonValue(info.bot_commands),
    botVerification: nullableJsonValue(info.bot_verification),
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
    inviteLink: nullableJsonValue(info.invite_link),
    isAllHistoryAvailable: info.is_all_history_available,
    linkedChatId: nullableZeroId(info.linked_chat_id),
    location: nullableJsonValue(info.location),
    mainProfileTab: nullableJsonValue(info.main_profile_tab),
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

function chatPhotoModels(photo: TdlibChatPhotoSource | null): ChatPhoto[] {
  return photo === null ? [] : [chatPhotoFromTdlibChatPhoto(photo)];
}

function fileStates(photo: TdlibChatPhotoSource | null): FileState[] {
  return photo === null ? [] : fileStatesFromTdlibChatPhoto(photo);
}

function nullableZeroId(value: number | string | null | undefined): string | null {
  const id = tdId(value);
  return id === undefined || id === '0' ? null : id;
}

function nullableJsonValue(value: unknown): JsonValue {
  return tdJsonValue(value ?? null) ?? null;
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
