import type { Database } from '../database/client.js';
import type {
  DirectMessagesChatTopic,
  SavedMessagesTag,
  SavedMessagesTopic
} from '../domain/models/topic.js';
import {
  replaceSavedMessagesTags,
  saveDirectMessagesChatTopic,
  saveSavedMessagesTopic
} from '../storage/topicStorage.js';

export type TopicRepository = {
  replaceSavedMessagesTags(input: {
    records: readonly SavedMessagesTag[];
    savedMessagesTopicId: string;
  }): Promise<void>;
  saveDirectMessagesChatTopic(topic: DirectMessagesChatTopic): Promise<void>;
  saveSavedMessagesTopic(topic: SavedMessagesTopic): Promise<void>;
  transaction<T>(operation: (repository: TopicRepository) => Promise<T>): Promise<T>;
};

export function createTopicRepository(database: Database): TopicRepository {
  return {
    replaceSavedMessagesTags(input) {
      return replaceSavedMessagesTags(database, input);
    },
    saveDirectMessagesChatTopic(topic) {
      return saveDirectMessagesChatTopic(database, topic);
    },
    saveSavedMessagesTopic(topic) {
      return saveSavedMessagesTopic(database, topic);
    },
    transaction(operation) {
      return database.transaction((transaction) => operation(createTopicRepository(transaction)));
    }
  };
}
