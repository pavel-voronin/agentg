import { createLogger } from '@agentg/framework';
import type {
  $Function,
  Chat,
  ChatList$Input,
  Chats,
  File,
  User,
  Message,
  Messages,
  Ok,
  error$Input
} from 'tdlib-types';

import type { InvokeOptions, Invoker } from './operationTypes.js';

const logger = createLogger('telegram');

type OperationDeps = {
  client: Invoker;
};

export function createOperations(deps: OperationDeps) {
  return {
    addFileToDownloads(
      input: {
        chatId: number;
        fileId: number;
        messageId: number;
        priority: number;
      },
      options?: InvokeOptions
    ): Promise<File> {
      return invoke(
        deps,
        {
          _: 'addFileToDownloads',
          chat_id: input.chatId,
          file_id: input.fileId,
          message_id: input.messageId,
          priority: input.priority
        },
        options
      ) as Promise<File>;
    },
    deleteFile(input: { fileId: number }, options?: InvokeOptions): Promise<Ok> {
      return invoke(deps, { _: 'deleteFile', file_id: input.fileId }, options) as Promise<Ok>;
    },
    downloadFile(
      input: {
        fileId: number;
        limit: number;
        offset: number;
        priority: number;
        synchronous: boolean;
      },
      options?: InvokeOptions
    ): Promise<File> {
      return invoke(
        deps,
        {
          _: 'downloadFile',
          file_id: input.fileId,
          limit: input.limit,
          offset: input.offset,
          priority: input.priority,
          synchronous: input.synchronous
        },
        options
      ) as Promise<File>;
    },
    finishFileGeneration(
      input: {
        error: error$Input | null;
        generationId: number | string;
      },
      options?: InvokeOptions
    ): Promise<Ok> {
      return invoke(
        deps,
        {
          _: 'finishFileGeneration',
          ...(input.error === null ? {} : { error: input.error }),
          generation_id: input.generationId
        },
        options
      ) as Promise<Ok>;
    },
    getChat(input: { chatId: number }, options?: InvokeOptions): Promise<Chat> {
      return invoke(deps, { _: 'getChat', chat_id: input.chatId }, options) as Promise<Chat>;
    },
    getFile(input: { fileId: number }, options?: InvokeOptions): Promise<File> {
      return invoke(deps, { _: 'getFile', file_id: input.fileId }, options) as Promise<File>;
    },
    getMessage(
      input: {
        chatId: number;
        messageId: number;
      },
      options?: InvokeOptions
    ): Promise<Message> {
      return invoke(
        deps,
        {
          _: 'getMessage',
          chat_id: input.chatId,
          message_id: input.messageId
        },
        options
      ) as Promise<Message>;
    },
    getMe(options?: InvokeOptions): Promise<User> {
      return invoke(deps, { _: 'getMe' }, options) as Promise<User>;
    },
    getChatHistory(
      input: {
        chatId: number;
        fromMessageId: number;
        limit: number;
        offset: number;
        onlyLocal: boolean;
      },
      options?: InvokeOptions
    ): Promise<Messages> {
      return invoke(
        deps,
        {
          _: 'getChatHistory',
          chat_id: input.chatId,
          from_message_id: input.fromMessageId,
          limit: input.limit,
          offset: input.offset,
          only_local: input.onlyLocal
        },
        options
      ) as Promise<Messages>;
    },
    getChatMessageByDate(
      input: {
        chatId: number;
        date: number;
      },
      options?: InvokeOptions
    ): Promise<Message> {
      return invoke(
        deps,
        {
          _: 'getChatMessageByDate',
          chat_id: input.chatId,
          date: input.date
        },
        options
      ) as Promise<Message>;
    },
    getDirectMessagesChatTopicHistory(
      input: {
        chatId: number;
        fromMessageId: number;
        limit: number;
        offset: number;
        topicId: number;
      },
      options?: InvokeOptions
    ): Promise<Messages> {
      return invoke(
        deps,
        {
          _: 'getDirectMessagesChatTopicHistory',
          chat_id: input.chatId,
          from_message_id: input.fromMessageId,
          limit: input.limit,
          offset: input.offset,
          topic_id: input.topicId
        },
        options
      ) as Promise<Messages>;
    },
    getDirectMessagesChatTopicMessageByDate(
      input: {
        chatId: number;
        date: number;
        topicId: number;
      },
      options?: InvokeOptions
    ): Promise<Message> {
      return invoke(
        deps,
        {
          _: 'getDirectMessagesChatTopicMessageByDate',
          chat_id: input.chatId,
          date: input.date,
          topic_id: input.topicId
        },
        options
      ) as Promise<Message>;
    },
    getForumTopicHistory(
      input: {
        chatId: number;
        forumTopicId: number;
        fromMessageId: number;
        limit: number;
        offset: number;
      },
      options?: InvokeOptions
    ): Promise<Messages> {
      return invoke(
        deps,
        {
          _: 'getForumTopicHistory',
          chat_id: input.chatId,
          forum_topic_id: input.forumTopicId,
          from_message_id: input.fromMessageId,
          limit: input.limit,
          offset: input.offset
        },
        options
      ) as Promise<Messages>;
    },
    getMessageThreadHistory(
      input: {
        chatId: number;
        fromMessageId: number;
        limit: number;
        messageId: number;
        offset: number;
      },
      options?: InvokeOptions
    ): Promise<Messages> {
      return invoke(
        deps,
        {
          _: 'getMessageThreadHistory',
          chat_id: input.chatId,
          from_message_id: input.fromMessageId,
          limit: input.limit,
          message_id: input.messageId,
          offset: input.offset
        },
        options
      ) as Promise<Messages>;
    },
    getSavedMessagesTopicHistory(
      input: {
        fromMessageId: number;
        limit: number;
        offset: number;
        topicId: number;
      },
      options?: InvokeOptions
    ): Promise<Messages> {
      return invoke(
        deps,
        {
          _: 'getSavedMessagesTopicHistory',
          from_message_id: input.fromMessageId,
          limit: input.limit,
          offset: input.offset,
          saved_messages_topic_id: input.topicId
        },
        options
      ) as Promise<Messages>;
    },
    getSavedMessagesTopicMessageByDate(
      input: {
        date: number;
        topicId: number;
      },
      options?: InvokeOptions
    ): Promise<Message> {
      return invoke(
        deps,
        {
          _: 'getSavedMessagesTopicMessageByDate',
          date: input.date,
          saved_messages_topic_id: input.topicId
        },
        options
      ) as Promise<Message>;
    },
    getChats(
      input: {
        chatList: ChatList$Input;
        limit: number;
      },
      options?: InvokeOptions
    ): Promise<Chats> {
      return invoke(
        deps,
        { _: 'getChats', chat_list: input.chatList, limit: input.limit },
        options
      ) as Promise<Chats>;
    },
    loadChats(
      input: {
        chatList: ChatList$Input;
        limit: number;
      },
      options?: InvokeOptions
    ): Promise<Ok> {
      return invoke(
        deps,
        { _: 'loadChats', chat_list: input.chatList, limit: input.limit },
        options
      ) as Promise<Ok>;
    },
    removeFileFromDownloads(
      input: {
        deleteFromCache: boolean;
        fileId: number;
      },
      options?: InvokeOptions
    ): Promise<Ok> {
      return invoke(
        deps,
        {
          _: 'removeFileFromDownloads',
          delete_from_cache: input.deleteFromCache,
          file_id: input.fileId
        },
        options
      ) as Promise<Ok>;
    },
    setFileGenerationProgress(
      input: {
        expectedSize: number;
        generationId: number | string;
        localPrefixSize: number;
      },
      options?: InvokeOptions
    ): Promise<Ok> {
      return invoke(
        deps,
        {
          _: 'setFileGenerationProgress',
          expected_size: input.expectedSize,
          generation_id: input.generationId,
          local_prefix_size: input.localPrefixSize
        },
        options
      ) as Promise<Ok>;
    }
  };
}

async function invoke(
  deps: OperationDeps,
  request: $Function,
  options: InvokeOptions = {}
): Promise<unknown> {
  for (;;) {
    try {
      return await deps.client.invoke(request, options);
    } catch (error) {
      const floodWaitSeconds = parseFloodWaitSeconds(error);
      if (floodWaitSeconds === undefined) {
        throw error;
      }

      logger.warn(
        {
          event: 'telegram.flood_wait',
          request: request._,
          seconds: floodWaitSeconds
        },
        'telegram flood wait'
      );
      await delay((floodWaitSeconds + 1) * 1000);
    }
  }
}

function parseFloodWaitSeconds(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = /FLOOD(?:_PREMIUM)?_WAIT_(\d+)/.exec(message);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export type Operations = ReturnType<typeof createOperations>;
