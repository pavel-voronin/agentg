import type { Database } from '../database/client.js';
import type { PollAnswerOption, PollOption, Poll } from '../domain/models/poll.js';
import { replacePollAnswerOptions, replacePoll } from '../storage/pollStorage.js';

export type PollRepository = {
  replacePoll(input: { options: readonly PollOption[]; poll: Poll }): Promise<void>;
  replacePollAnswerOptions(input: {
    options: readonly PollAnswerOption[];
    pollId: string;
    voterId: string;
  }): Promise<void>;
  transaction<T>(operation: (repository: PollRepository) => Promise<T>): Promise<T>;
};

export function createPollRepository(database: Database): PollRepository {
  return {
    replacePoll(input) {
      return replacePoll(database, input);
    },
    replacePollAnswerOptions(input) {
      return replacePollAnswerOptions(database, input);
    },
    transaction(operation) {
      return database.transaction((transaction) => operation(createPollRepository(transaction)));
    }
  };
}
