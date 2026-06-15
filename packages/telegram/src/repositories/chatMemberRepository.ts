import type { Database } from '../database/client.js';
import type { ChatInviteLink, ChatJoinRequest, ChatMember } from '../domain/models/chatMember.js';
import {
  saveChatJoinRequestUpdateRecords,
  saveChatMemberUpdateRecords
} from '../storage/chatMemberStorage.js';

export type ChatMemberRepository = {
  saveJoinRequest(input: {
    inviteLink: ChatInviteLink | null;
    request: ChatJoinRequest;
  }): Promise<void>;
  saveMember(input: { inviteLink: ChatInviteLink | null; member: ChatMember }): Promise<void>;
  transaction<T>(operation: (repository: ChatMemberRepository) => Promise<T>): Promise<T>;
};

export function createChatMemberRepository(database: Database): ChatMemberRepository {
  return {
    saveJoinRequest(input) {
      return saveChatJoinRequestUpdateRecords(database, input);
    },
    saveMember(input) {
      return saveChatMemberUpdateRecords(database, input);
    },
    transaction(operation) {
      return database.transaction((transaction) =>
        operation(createChatMemberRepository(transaction))
      );
    }
  };
}
