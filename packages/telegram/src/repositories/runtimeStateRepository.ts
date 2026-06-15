import type { Database } from '../database/client.js';
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
import {
  deleteGroupCallMessageStates,
  deleteGroupCallParticipant,
  patchGroupCallMessageErrorRecord,
  replaceLanguagePackStrings,
  saveForumTopicInfo,
  saveForumTopic,
  saveGroupCallEncryptedParticipantUsers,
  saveGroupCallMessageState,
  saveGroupCallParticipant,
  saveGroupCall,
  saveGroupCallVerificationState,
  saveLiveStoryDonors,
  saveManagedBot
} from '../storage/runtimeStateStorage.js';

export type RuntimeStateRepository = {
  deleteGroupCallMessages(input: {
    groupCallId: number;
    messageIds: readonly number[];
  }): Promise<void>;
  deleteGroupCallParticipant(input: { groupCallId: number; participantId: string }): Promise<void>;
  patchGroupCallMessageError(input: {
    error: NonNullable<GroupCallMessageState['error']>;
    groupCallId: number;
    messageId: number;
  }): Promise<void>;
  replaceLanguagePackStrings(input: {
    languagePackId: string;
    localizationTarget: string;
    strings: readonly LanguagePackString[];
  }): Promise<void>;
  saveForumTopic(topic: ForumTopic): Promise<void>;
  saveForumTopicInfo(info: ForumTopicInfo): Promise<void>;
  saveGroupCall(groupCall: GroupCall): Promise<void>;
  saveGroupCallEncryptedParticipantUsers(record: GroupCallEncryptedParticipantUsers): Promise<void>;
  saveGroupCallMessage(message: GroupCallMessageState): Promise<void>;
  saveGroupCallParticipant(participant: GroupCallParticipant): Promise<void>;
  saveGroupCallVerificationState(state: GroupCallVerificationState): Promise<void>;
  saveLiveStoryDonors(donors: LiveStoryDonors): Promise<void>;
  saveManagedBot(bot: ManagedBot): Promise<void>;
  transaction<T>(operation: (repository: RuntimeStateRepository) => Promise<T>): Promise<T>;
};

export function createRuntimeStateRepository(database: Database): RuntimeStateRepository {
  return {
    deleteGroupCallMessages(input) {
      return deleteGroupCallMessageStates(database, input);
    },
    deleteGroupCallParticipant(input) {
      return deleteGroupCallParticipant(database, input);
    },
    patchGroupCallMessageError(input) {
      return patchGroupCallMessageErrorRecord(database, input);
    },
    replaceLanguagePackStrings(input) {
      return replaceLanguagePackStrings(database, input);
    },
    saveForumTopic(topic) {
      return saveForumTopic(database, topic);
    },
    saveForumTopicInfo(info) {
      return saveForumTopicInfo(database, info);
    },
    saveGroupCall(groupCall) {
      return saveGroupCall(database, groupCall);
    },
    saveGroupCallEncryptedParticipantUsers(record) {
      return saveGroupCallEncryptedParticipantUsers(database, record);
    },
    saveGroupCallMessage(message) {
      return saveGroupCallMessageState(database, message);
    },
    saveGroupCallParticipant(participant) {
      return saveGroupCallParticipant(database, participant);
    },
    saveGroupCallVerificationState(state) {
      return saveGroupCallVerificationState(database, state);
    },
    saveLiveStoryDonors(donors) {
      return saveLiveStoryDonors(database, donors);
    },
    saveManagedBot(bot) {
      return saveManagedBot(database, bot);
    },
    transaction(operation) {
      return database.transaction((transaction) =>
        operation(createRuntimeStateRepository(transaction))
      );
    }
  };
}
