import { telegramGroupCalls } from '../../database/schema.js';
import { tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type GroupCallUpdate = UpdateByType<'updateGroupCall'>;
type GroupCall = GroupCallUpdate['group_call'];

export async function handleUpdateGroupCall(
  { group_call: groupCall }: GroupCallUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const row = telegramGroupCallRow(groupCall);
  await database.insert(telegramGroupCalls).values(row).onConflictDoUpdate({
    set: row,
    target: telegramGroupCalls.id
  });
}

function telegramGroupCallRow(groupCall: GroupCall): typeof telegramGroupCalls.$inferInsert {
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

function requiredJsonValue(value: unknown) {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
