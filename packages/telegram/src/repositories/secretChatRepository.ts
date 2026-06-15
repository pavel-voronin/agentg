import type { Database } from '../database/client.js';
import type { SecretChatState } from '../domain/models/secretChat.js';
import { saveSecretChatState } from '../storage/secretChatStorage.js';

export type SecretChatRepository = {
  save(chat: SecretChatState): Promise<void>;
  transaction<T>(operation: (repository: SecretChatRepository) => Promise<T>): Promise<T>;
};

export function createSecretChatRepository(database: Database): SecretChatRepository {
  return {
    save(chat) {
      return saveSecretChatState(database, chat);
    },
    transaction(operation) {
      return database.transaction((transaction) =>
        operation(createSecretChatRepository(transaction))
      );
    }
  };
}
