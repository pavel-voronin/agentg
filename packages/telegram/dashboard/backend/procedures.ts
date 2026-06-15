import type { EventBus } from '@agentg/framework';
import { z } from 'zod';

import { TELEGRAM_DASHBOARD_METHODS } from '../contracts.js';
import type { Database } from '../../src/database/client.js';
import type { telegramClient } from '../../src/index.js';
import { createMessageRepository } from '../../src/repositories/messageRepository.js';
import { createChatDirectoryRepository } from '../../src/repositories/chatDirectoryRepository.js';
import {
  chatDirectoryInputSchema,
  chatDirectoryOutputSchema,
  fileRequestInputSchema,
  fileRequestOutputSchema,
  messageLookupInputSchema,
  messageLookupOutputSchema,
  getMessagesInputSchema,
  getMessagesOutputSchema
} from './models.js';

type ChatDirectoryInput = z.infer<typeof chatDirectoryInputSchema>;
type ChatDirectoryOutput = z.infer<typeof chatDirectoryOutputSchema>;
type FileRequestInput = z.infer<typeof fileRequestInputSchema>;
type FileRequestOutput = z.infer<typeof fileRequestOutputSchema>;
type MessageLookupInput = z.infer<typeof messageLookupInputSchema>;
type MessageLookupOutput = z.infer<typeof messageLookupOutputSchema>;
type GetMessagesInput = z.infer<typeof getMessagesInputSchema>;
type GetMessagesOutput = z.infer<typeof getMessagesOutputSchema>;
type TelegramDashboardClient = Pick<
  ReturnType<typeof telegramClient>,
  'getMessages' | 'requestFile'
>;

type Resources = {
  database: Database;
  events: EventBus;
  telegram: TelegramDashboardClient;
};

export function createProcedures(resources: Resources) {
  return {
    [TELEGRAM_DASHBOARD_METHODS.chatDirectory]: async (
      input: unknown
    ): Promise<ChatDirectoryOutput> => {
      const output = await runChatDirectory(chatDirectoryInputSchema.parse(input), resources);
      return chatDirectoryOutputSchema.parse(output);
    },
    [TELEGRAM_DASHBOARD_METHODS.message]: async (input: unknown): Promise<MessageLookupOutput> => {
      const output = await runMessage(messageLookupInputSchema.parse(input), resources);
      return messageLookupOutputSchema.parse(output);
    },
    [TELEGRAM_DASHBOARD_METHODS.getMessages]: async (
      input: unknown
    ): Promise<GetMessagesOutput> => {
      const output = await runGetMessages(getMessagesInputSchema.parse(input), resources);
      return getMessagesOutputSchema.parse(output);
    },
    [TELEGRAM_DASHBOARD_METHODS.requestFile]: async (
      input: unknown
    ): Promise<FileRequestOutput> => {
      const output = await requestFile(fileRequestInputSchema.parse(input), resources);
      return fileRequestOutputSchema.parse(output);
    }
  };
}

async function runChatDirectory(
  input: ChatDirectoryInput,
  resources: Resources
): Promise<ChatDirectoryOutput> {
  return createChatDirectoryRepository(resources.database).list(input);
}

async function runMessage(
  input: MessageLookupInput,
  resources: Resources
): Promise<MessageLookupOutput> {
  return {
    message: await readMessage(resources.database, input)
  };
}

async function readMessage(
  database: Database,
  input: MessageLookupInput
): Promise<MessageLookupOutput['message']> {
  return createMessageRepository(database).read(input);
}

async function runGetMessages(
  input: GetMessagesInput,
  resources: Resources
): Promise<GetMessagesOutput> {
  return resources.telegram.getMessages(input);
}

async function requestFile(
  input: FileRequestInput,
  resources: Resources
): Promise<FileRequestOutput> {
  return resources.telegram.requestFile(input);
}
