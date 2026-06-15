import type { Database } from '../database/client.js';
import type { StoryIdentity, StoryState } from '../domain/models/story.js';
import { deleteStoryState, saveStoryState } from '../storage/storyStorage.js';

export type StoryRepository = {
  delete(story: StoryIdentity): Promise<void>;
  save(story: StoryState): Promise<void>;
  transaction<T>(operation: (repository: StoryRepository) => Promise<T>): Promise<T>;
};

export function createStoryRepository(database: Database): StoryRepository {
  return {
    delete(story) {
      return deleteStoryState(database, story);
    },
    save(story) {
      return saveStoryState(database, story);
    },
    transaction(operation) {
      return database.transaction((transaction) => operation(createStoryRepository(transaction)));
    }
  };
}
