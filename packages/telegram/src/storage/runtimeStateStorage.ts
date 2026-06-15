import { and, eq, inArray, sql } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramForumTopicInfos,
  telegramForumTopics,
  telegramGroupCallEncryptedParticipantUsers,
  telegramGroupCallMessages,
  telegramGroupCallParticipants,
  telegramGroupCalls,
  telegramGroupCallVerificationStates,
  telegramLanguagePackStrings,
  telegramLiveStoryDonors,
  telegramManagedBots
} from '../database/schema.js';
import type {
  ForumTopicInfo,
  ForumTopic,
  GroupCallEncryptedParticipantUsers,
  GroupCallMessageState,
  GroupCallParticipant,
  GroupCall,
  GroupCallVerificationState,
  LanguagePackString,
  LiveStoryDonors,
  ManagedBot
} from '../domain/models/runtimeState.js';

export async function saveForumTopic(database: Database, topic: ForumTopic): Promise<void> {
  await database
    .insert(telegramForumTopics)
    .values(topic)
    .onConflictDoUpdate({
      set: topic,
      target: [telegramForumTopics.chatId, telegramForumTopics.forumTopicId]
    });
}

export async function saveForumTopicInfo(database: Database, info: ForumTopicInfo): Promise<void> {
  await database
    .insert(telegramForumTopicInfos)
    .values(info)
    .onConflictDoUpdate({
      set: info,
      target: [telegramForumTopicInfos.chatId, telegramForumTopicInfos.forumTopicId]
    });
}

export async function saveGroupCall(database: Database, groupCall: GroupCall): Promise<void> {
  await database.insert(telegramGroupCalls).values(groupCall).onConflictDoUpdate({
    set: groupCall,
    target: telegramGroupCalls.id
  });
}

export async function saveGroupCallMessageState(
  database: Database,
  message: GroupCallMessageState
): Promise<void> {
  await database
    .insert(telegramGroupCallMessages)
    .values(message)
    .onConflictDoUpdate({
      set: message,
      target: [telegramGroupCallMessages.groupCallId, telegramGroupCallMessages.messageId]
    });
}

export async function patchGroupCallMessageErrorRecord(
  database: Database,
  input: {
    error: NonNullable<GroupCallMessageState['error']>;
    groupCallId: number;
    messageId: number;
  }
): Promise<void> {
  const row: GroupCallMessageState = {
    error: input.error,
    groupCallId: input.groupCallId,
    messageId: input.messageId
  };
  await database
    .insert(telegramGroupCallMessages)
    .values(row)
    .onConflictDoUpdate({
      set: {
        error: input.error
      },
      target: [telegramGroupCallMessages.groupCallId, telegramGroupCallMessages.messageId]
    });
}

export async function deleteGroupCallMessageStates(
  database: Database,
  input: {
    groupCallId: number;
    messageIds: readonly number[];
  }
): Promise<void> {
  if (input.messageIds.length === 0) {
    return;
  }
  await database
    .delete(telegramGroupCallMessages)
    .where(
      and(
        eq(telegramGroupCallMessages.groupCallId, input.groupCallId),
        inArray(telegramGroupCallMessages.messageId, [...input.messageIds])
      )
    );
}

export async function saveGroupCallParticipant(
  database: Database,
  participant: GroupCallParticipant
): Promise<void> {
  await database
    .insert(telegramGroupCallParticipants)
    .values(participant)
    .onConflictDoUpdate({
      set: participant,
      target: [
        telegramGroupCallParticipants.groupCallId,
        telegramGroupCallParticipants.participantId
      ]
    });
}

export async function deleteGroupCallParticipant(
  database: Database,
  input: {
    groupCallId: number;
    participantId: string;
  }
): Promise<void> {
  await database
    .delete(telegramGroupCallParticipants)
    .where(
      and(
        eq(telegramGroupCallParticipants.groupCallId, input.groupCallId),
        eq(telegramGroupCallParticipants.participantId, input.participantId)
      )
    );
}

export async function saveGroupCallEncryptedParticipantUsers(
  database: Database,
  record: GroupCallEncryptedParticipantUsers
): Promise<void> {
  await database
    .insert(telegramGroupCallEncryptedParticipantUsers)
    .values(record)
    .onConflictDoUpdate({
      set: record,
      target: telegramGroupCallEncryptedParticipantUsers.groupCallId
    });
}

export async function saveGroupCallVerificationState(
  database: Database,
  state: GroupCallVerificationState
): Promise<void> {
  await database
    .insert(telegramGroupCallVerificationStates)
    .values(state)
    .onConflictDoUpdate({
      set: {
        emojis: state.emojis,
        generation: state.generation
      },
      target: telegramGroupCallVerificationStates.groupCallId
    });
}

export async function replaceLanguagePackStrings(
  database: Database,
  input: {
    languagePackId: string;
    localizationTarget: string;
    strings: readonly LanguagePackString[];
  }
): Promise<void> {
  if (input.strings.length === 0) {
    await database
      .delete(telegramLanguagePackStrings)
      .where(
        and(
          eq(telegramLanguagePackStrings.localizationTarget, input.localizationTarget),
          eq(telegramLanguagePackStrings.languagePackId, input.languagePackId)
        )
      );
    return;
  }

  await database
    .insert(telegramLanguagePackStrings)
    .values([...input.strings])
    .onConflictDoUpdate({
      set: {
        value: sql`excluded.value`
      },
      target: [
        telegramLanguagePackStrings.localizationTarget,
        telegramLanguagePackStrings.languagePackId,
        telegramLanguagePackStrings.key
      ]
    });
}

export async function saveLiveStoryDonors(
  database: Database,
  donors: LiveStoryDonors
): Promise<void> {
  await database.insert(telegramLiveStoryDonors).values(donors).onConflictDoUpdate({
    set: donors,
    target: telegramLiveStoryDonors.groupCallId
  });
}

export async function saveManagedBot(database: Database, bot: ManagedBot): Promise<void> {
  await database.insert(telegramManagedBots).values(bot).onConflictDoUpdate({
    set: bot,
    target: telegramManagedBots.botUserId
  });
}
