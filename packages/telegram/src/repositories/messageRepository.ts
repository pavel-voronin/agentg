import type { Database } from '../database/client.js';
import type { Message } from '../domain/models/message.js';
import {
  messageReactionSummariesFromJsonState,
  type MessageReactionSummary
} from '../domain/models/messageReactionState.js';
import type { MessageState, MessagePatch } from '../domain/models/messageState.js';
import type { FileOwnerKey } from '../files/types.js';
import { ownerKey, readFileRefsForOwners } from '../storage/fileReadStorage.js';
import {
  readMessageRow,
  readMessageRowsByRefs,
  readRecentMessageRows,
  searchMessageRows,
  type MessageSearchRead,
  type RecentMessageRead
} from '../storage/messageReadStorage.js';
import {
  messageFileOwner,
  readMessageSenderDisplayInfo,
  senderDisplayKey,
  timeMessageViewStage,
  type MessageStorageRow
} from '../storage/messageRowStorage.js';
import {
  clearMessageSchedulingState,
  clearMessageSendAcknowledgementState,
  deleteMessageStates,
  markMessageSendAcknowledgedState,
  markMessageContentOpened,
  readMessageReactionStateForUpdate,
  replaceActiveLiveLocationMessageStates,
  replaceMessageReactionSummariesState,
  saveMessageState,
  saveMessageStates,
  upsertMessagePatch,
  type SaveMessageConflict
} from '../storage/messageStorage.js';
import { messageFromStorageRow } from './messageAssembler.js';

export type MessageRepository = {
  clearSchedulingState(input: { chatId: string; messageId: string }): Promise<boolean>;
  clearSendAcknowledgement(input: { chatId: string; messageId: string }): Promise<void>;
  delete(input: { chatId: string; messageIds: string[] }): Promise<void>;
  listRecent(input: RecentMessageRead): Promise<Message[]>;
  markContentOpened(input: { chatId: string; messageId: string }): Promise<boolean>;
  markSendAcknowledged(input: { chatId: string; messageId: string }): Promise<boolean>;
  read(input: { chatId: string; messageId: string }): Promise<Message | null>;
  readManyByRefs(
    refs: readonly {
      chatId: string;
      messageId: string;
    }[]
  ): Promise<Message[]>;
  readReactionSummariesForUpdate(input: {
    chatId: string;
    messageId: string;
  }): Promise<MessageReactionSummary[]>;
  search(input: MessageSearchRead): Promise<Message[]>;
  save(message: MessageState, options?: { conflict?: SaveMessageConflict }): Promise<boolean>;
  saveMany(
    messages: readonly MessageState[],
    options?: { conflict?: SaveMessageConflict }
  ): Promise<number>;
  transaction<T>(operation: (repository: MessageRepository) => Promise<T>): Promise<T>;
  replaceActiveLiveLocationMessages(
    messages: readonly { chatId: string; messageId: string }[]
  ): Promise<void>;
  replaceReactionSummaries(input: {
    chatId: string;
    messageId: string;
    reactions: readonly MessageReactionSummary[];
  }): Promise<void>;
  upsert(message: MessagePatch): Promise<void>;
};

export function createMessageRepository(database: Database): MessageRepository {
  return {
    clearSchedulingState(input) {
      return clearMessageSchedulingState(database, input);
    },
    clearSendAcknowledgement(input) {
      return clearMessageSendAcknowledgementState(database, input);
    },
    delete(input) {
      return deleteMessageStates(database, input);
    },
    async listRecent(input) {
      return hydrateMessageRows(database, await readRecentMessageRows(database, input));
    },
    markContentOpened(input) {
      return markMessageContentOpened(database, input);
    },
    markSendAcknowledged(input) {
      return markMessageSendAcknowledgedState(database, input);
    },
    async read(input) {
      const row = await readMessageRow(database, input);
      if (row === undefined) {
        return null;
      }
      const [message] = await hydrateMessageRows(database, [row]);
      return message ?? null;
    },
    async readManyByRefs(refs) {
      return hydrateMessageRows(database, await readMessageRowsByRefs(database, refs));
    },
    async readReactionSummariesForUpdate(input) {
      return messageReactionSummariesFromJsonState(
        await readMessageReactionStateForUpdate(database, input)
      );
    },
    async search(input) {
      return hydrateMessageRows(database, await searchMessageRows(database, input));
    },
    save(message, options) {
      return saveMessageState(database, message, options?.conflict);
    },
    saveMany(messages, options) {
      return saveMessageStates(database, messages, options?.conflict);
    },
    transaction(operation) {
      return database.transaction((transaction) => operation(createMessageRepository(transaction)));
    },
    replaceActiveLiveLocationMessages(messages) {
      return replaceActiveLiveLocationMessageStates(database, messages);
    },
    replaceReactionSummaries(input) {
      return replaceMessageReactionSummariesState(database, input);
    },
    upsert(message) {
      return upsertMessagePatch(database, message);
    }
  };
}

export async function hydrateMessageRows(
  database: Database,
  rows: MessageStorageRow[]
): Promise<Message[]> {
  const senderInfoByKey = await readMessageSenderDisplayInfo(database, rows);
  const filesByOwner = await timeMessageViewStage('file_hydration', () =>
    readFileRefsForOwners(database, messageFileOwners(rows))
  );

  return timeMessageViewStage('assemble', () =>
    Promise.resolve(
      rows.map((row) => {
        const domainMessage = messageFromStorageRow(
          row,
          filesByOwner.get(ownerKey(messageFileOwner(row))) ?? []
        );
        const senderKey = senderDisplayKey(row.senderType, row.senderId);
        return {
          ...domainMessage,
          senderDisplayName:
            senderKey === null ? null : (senderInfoByKey.get(senderKey)?.displayName ?? null),
          serviceAction: null
        };
      })
    )
  );
}

function messageFileOwners(rows: MessageStorageRow[]): FileOwnerKey[] {
  return rows.map(messageFileOwner);
}
