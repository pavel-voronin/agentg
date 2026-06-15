import type { JsonValue } from '@agentg/framework';

import type {
  DomainChange,
  FileGenerationRequestDeletedChange,
  ForumTopicInfoSavedChange,
  ForumTopicSavedChange,
  GroupCallEncryptedParticipantUsersSavedChange,
  GroupCallMessageDeletedChange,
  GroupCallMessageErrorPatchedChange,
  GroupCallMessageSavedChange,
  GroupCallParticipantDeletedChange,
  GroupCallParticipantSavedChange,
  GroupCallSavedChange,
  GroupCallVerificationStateSavedChange,
  LanguagePackStringsReplacedChange,
  LiveStoryDonorsSavedChange,
  ManagedBotSavedChange
} from '../../domain/changes.js';
import type {
  ForumTopicInfo,
  ForumTopic,
  GroupCallMessageState,
  GroupCallParticipant,
  GroupCall
} from '../../domain/models/runtimeState.js';
import { tdDate, tdId, tdJsonObject, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';

type FileGenerationStopUpdate = UpdateByType<'updateFileGenerationStop'>;
type ForumTopicUpdate = UpdateByType<'updateForumTopic'>;
type ForumTopicInfoUpdate = UpdateByType<'updateForumTopicInfo'>;
type TdlibForumTopicInfo = ForumTopicInfoUpdate['info'];
type GroupCallUpdate = UpdateByType<'updateGroupCall'>;
type TdlibGroupCall = GroupCallUpdate['group_call'];
type GroupCallMessageSendFailedUpdate = UpdateByType<'updateGroupCallMessageSendFailed'>;
type GroupCallMessagesDeletedUpdate = UpdateByType<'updateGroupCallMessagesDeleted'>;
type GroupCallParticipantUpdate = UpdateByType<'updateGroupCallParticipant'>;
type TdlibGroupCallParticipant = GroupCallParticipantUpdate['participant'];
type GroupCallParticipantId = TdlibGroupCallParticipant['participant_id'];
type GroupCallParticipantsUpdate = UpdateByType<'updateGroupCallParticipants'>;
type GroupCallVerificationStateUpdate = UpdateByType<'updateGroupCallVerificationState'>;
type LanguagePackStringsUpdate = UpdateByType<'updateLanguagePackStrings'>;
type LiveStoryTopDonorsUpdate = UpdateByType<'updateLiveStoryTopDonors'>;
type ManagedBotUpdate = UpdateByType<'updateManagedBot'>;
type NewGroupCallMessageUpdate = UpdateByType<'updateNewGroupCallMessage'>;

export function fileGenerationStopChanges(update: FileGenerationStopUpdate): DomainChange[] {
  return [
    {
      kind: 'fileGenerationRequest.deleted',
      generationId: update.generation_id
    } satisfies FileGenerationRequestDeletedChange
  ];
}

export function forumTopicChanges(update: ForumTopicUpdate): DomainChange[] {
  return [
    {
      kind: 'forumTopic.saved',
      topic: forumTopicRecord(update)
    } satisfies ForumTopicSavedChange
  ];
}

export function forumTopicInfoChanges(update: ForumTopicInfoUpdate): DomainChange[] {
  return [
    {
      kind: 'forumTopicInfo.saved',
      info: forumTopicInfoRecord(update.info)
    } satisfies ForumTopicInfoSavedChange
  ];
}

export function groupCallChanges(update: GroupCallUpdate): DomainChange[] {
  return [
    {
      kind: 'groupCall.saved',
      groupCall: groupCall(update.group_call)
    } satisfies GroupCallSavedChange
  ];
}

export function groupCallMessageSendFailedChanges(
  update: GroupCallMessageSendFailedUpdate
): DomainChange[] {
  return [
    {
      kind: 'groupCallMessage.errorPatched',
      input: {
        error: tdJsonObject(update.error),
        groupCallId: update.group_call_id,
        messageId: update.message_id
      }
    } satisfies GroupCallMessageErrorPatchedChange
  ];
}

export function groupCallMessagesDeletedChanges(
  update: GroupCallMessagesDeletedUpdate
): DomainChange[] {
  return [
    {
      kind: 'groupCallMessages.deleted',
      input: {
        groupCallId: update.group_call_id,
        messageIds: update.message_ids
      }
    } satisfies GroupCallMessageDeletedChange
  ];
}

export function groupCallParticipantChanges(update: GroupCallParticipantUpdate): DomainChange[] {
  const participantId = messageSenderKey(update.participant.participant_id);
  if (update.participant.order === '') {
    return [
      {
        kind: 'groupCallParticipant.deleted',
        input: {
          groupCallId: update.group_call_id,
          participantId
        }
      } satisfies GroupCallParticipantDeletedChange
    ];
  }

  return [
    {
      kind: 'groupCallParticipant.saved',
      participant: groupCallParticipantRecord(
        update.group_call_id,
        participantId,
        update.participant
      )
    } satisfies GroupCallParticipantSavedChange
  ];
}

export function groupCallParticipantsChanges(update: GroupCallParticipantsUpdate): DomainChange[] {
  return [
    {
      kind: 'groupCallEncryptedParticipantUsers.saved',
      record: {
        groupCallId: update.group_call_id,
        participantUserIds: tdJsonValue(update.participant_user_ids) ?? []
      }
    } satisfies GroupCallEncryptedParticipantUsersSavedChange
  ];
}

export function groupCallVerificationStateChanges(
  update: GroupCallVerificationStateUpdate
): DomainChange[] {
  return [
    {
      kind: 'groupCallVerificationState.saved',
      state: {
        emojis: tdJsonValue(update.emojis) ?? [],
        generation: update.generation,
        groupCallId: update.group_call_id
      }
    } satisfies GroupCallVerificationStateSavedChange
  ];
}

export function languagePackStringsChanges(update: LanguagePackStringsUpdate): DomainChange[] {
  return [
    {
      kind: 'languagePackStrings.replaced',
      input: {
        languagePackId: update.language_pack_id,
        localizationTarget: update.localization_target,
        strings: update.strings.map((string) => ({
          key: string.key,
          languagePackId: update.language_pack_id,
          localizationTarget: update.localization_target,
          value: tdJsonValue(string.value)
        }))
      }
    } satisfies LanguagePackStringsReplacedChange
  ];
}

export function liveStoryTopDonorsChanges(update: LiveStoryTopDonorsUpdate): DomainChange[] {
  return [
    {
      kind: 'liveStoryDonors.saved',
      donors: {
        groupCallId: update.group_call_id,
        topDonors: requiredJsonValue(update.donors.top_donors),
        totalStarCount: String(update.donors.total_star_count)
      }
    } satisfies LiveStoryDonorsSavedChange
  ];
}

export function managedBotChanges(update: ManagedBotUpdate): DomainChange[] {
  return [
    {
      kind: 'managedBot.saved',
      bot: {
        botUserId: String(update.bot_user_id),
        creatorUserId: String(update.user_id)
      }
    } satisfies ManagedBotSavedChange
  ];
}

export function newGroupCallMessageChanges(update: NewGroupCallMessageUpdate): DomainChange[] {
  return [
    {
      kind: 'groupCallMessage.saved',
      message: groupCallMessageState(update)
    } satisfies GroupCallMessageSavedChange
  ];
}

function forumTopicRecord(update: ForumTopicUpdate): ForumTopic {
  return {
    chatId: String(update.chat_id),
    draftMessage: tdJsonValue(update.draft_message ?? null) ?? null,
    forumTopicId: update.forum_topic_id,
    isPinned: update.is_pinned,
    lastReadInboxMessageId: tdId(update.last_read_inbox_message_id),
    lastReadOutboxMessageId: tdId(update.last_read_outbox_message_id),
    notificationSettings: tdJsonObject(update.notification_settings),
    unreadMentionCount: update.unread_mention_count,
    unreadPollVoteCount: update.unread_poll_vote_count,
    unreadReactionCount: update.unread_reaction_count
  };
}

function forumTopicInfoRecord(info: TdlibForumTopicInfo): ForumTopicInfo {
  return {
    chatId: String(info.chat_id),
    creationDate: new Date(info.creation_date * 1000),
    creatorId: tdJsonObject(info.creator_id),
    forumTopicId: info.forum_topic_id,
    icon: tdJsonObject(info.icon),
    isClosed: info.is_closed,
    isGeneral: info.is_general,
    isHidden: info.is_hidden,
    isNameImplicit: info.is_name_implicit,
    isOutgoing: info.is_outgoing,
    name: info.name
  };
}

function groupCall(groupCall: TdlibGroupCall): GroupCall {
  return {
    areMessagesAllowed: groupCall.are_messages_allowed,
    canBeManaged: groupCall.can_be_managed,
    canDeleteMessages: groupCall.can_delete_messages,
    canEnableVideo: groupCall.can_enable_video,
    canSendMessages: groupCall.can_send_messages,
    canToggleAreMessagesAllowed: groupCall.can_toggle_are_messages_allowed,
    canToggleMuteNewParticipants: groupCall.can_toggle_mute_new_participants,
    duration: groupCall.duration,
    enabledStartNotification: groupCall.enabled_start_notification,
    hasHiddenListeners: groupCall.has_hidden_listeners,
    id: groupCall.id,
    inviteLink: groupCall.invite_link,
    isActive: groupCall.is_active,
    isJoined: groupCall.is_joined,
    isLiveStory: groupCall.is_live_story,
    isMyVideoEnabled: groupCall.is_my_video_enabled,
    isMyVideoPaused: groupCall.is_my_video_paused,
    isOwned: groupCall.is_owned,
    isRtmpStream: groupCall.is_rtmp_stream,
    isVideoChat: groupCall.is_video_chat,
    isVideoRecorded: groupCall.is_video_recorded,
    loadedAllParticipants: groupCall.loaded_all_participants,
    messageSenderId: tdJsonValue(groupCall.message_sender_id ?? null) ?? null,
    muteNewParticipants: groupCall.mute_new_participants,
    needRejoin: groupCall.need_rejoin,
    paidMessageStarCount: String(groupCall.paid_message_star_count),
    participantCount: groupCall.participant_count,
    recentSpeakers: requiredJsonValue(groupCall.recent_speakers),
    recordDuration: groupCall.record_duration,
    scheduledStartDate: new Date(groupCall.scheduled_start_date * 1000),
    title: groupCall.title,
    uniqueId: groupCall.unique_id
  };
}

function groupCallMessageState(update: NewGroupCallMessageUpdate): GroupCallMessageState {
  return {
    canBeDeleted: update.message.can_be_deleted,
    date: requiredDate(update.message.date),
    error: null,
    groupCallId: update.group_call_id,
    isFromOwner: update.message.is_from_owner,
    messageId: update.message.message_id,
    paidMessageStarCount: tdId(update.message.paid_message_star_count),
    senderId: tdJsonObject(update.message.sender_id),
    text: tdJsonObject(update.message.text)
  };
}

function groupCallParticipantRecord(
  groupCallId: number,
  participantId: string,
  participant: TdlibGroupCallParticipant
): GroupCallParticipant {
  return {
    audioSourceId: participant.audio_source_id,
    bio: participant.bio,
    canBeMutedForAllUsers: participant.can_be_muted_for_all_users,
    canBeMutedForCurrentUser: participant.can_be_muted_for_current_user,
    canBeUnmutedForAllUsers: participant.can_be_unmuted_for_all_users,
    canBeUnmutedForCurrentUser: participant.can_be_unmuted_for_current_user,
    canUnmuteSelf: participant.can_unmute_self,
    groupCallId,
    isCurrentUser: participant.is_current_user,
    isHandRaised: participant.is_hand_raised,
    isMutedForAllUsers: participant.is_muted_for_all_users,
    isMutedForCurrentUser: participant.is_muted_for_current_user,
    isSpeaking: participant.is_speaking,
    order: participant.order,
    participantId,
    screenSharingAudioSourceId: participant.screen_sharing_audio_source_id,
    screenSharingVideoInfo: tdJsonValue(participant.screen_sharing_video_info ?? null) ?? null,
    videoInfo: tdJsonValue(participant.video_info ?? null) ?? null,
    volumeLevel: participant.volume_level
  };
}

function messageSenderKey(sender: GroupCallParticipantId): string {
  if (sender._ === 'messageSenderUser') {
    return `telegram.user:${String(sender.user_id)}`;
  }

  return `telegram.chat:${String(sender.chat_id)}`;
}

function requiredDate(value: number): Date {
  const date = tdDate(value);
  if (date === undefined) {
    throw new Error('Expected Telegram wire date');
  }
  return date;
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
