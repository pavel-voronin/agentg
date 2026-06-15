import { and, eq } from 'drizzle-orm';

import { telegramGroupCallParticipants } from '../../database/schema.js';
import { tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type GroupCallParticipantUpdate = UpdateByType<'updateGroupCallParticipant'>;
type GroupCallParticipant = GroupCallParticipantUpdate['participant'];
type GroupCallParticipantId = GroupCallParticipant['participant_id'];

export async function handleUpdateGroupCallParticipant(
  update: GroupCallParticipantUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const groupCallId = update.group_call_id;
  const participantId = messageSenderKey(update.participant.participant_id);
  const removed = update.participant.order === '';

  if (removed) {
    await database
      .delete(telegramGroupCallParticipants)
      .where(
        and(
          eq(telegramGroupCallParticipants.groupCallId, groupCallId),
          eq(telegramGroupCallParticipants.participantId, participantId)
        )
      );
  } else {
    const row = telegramGroupCallParticipantRow(groupCallId, participantId, update.participant);
    await database
      .insert(telegramGroupCallParticipants)
      .values(row)
      .onConflictDoUpdate({
        set: row,
        target: [
          telegramGroupCallParticipants.groupCallId,
          telegramGroupCallParticipants.participantId
        ]
      });
  }
}

function telegramGroupCallParticipantRow(
  groupCallId: number,
  participantId: string,
  participant: GroupCallParticipant
): typeof telegramGroupCallParticipants.$inferInsert {
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
