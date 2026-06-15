import { and, eq } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramPollAnswerOptions,
  telegramPollOptions,
  telegramPolls
} from '../database/schema.js';
import type { PollAnswerOption, PollOption, Poll } from '../domain/models/poll.js';

export async function replacePoll(
  database: Database,
  input: {
    options: readonly PollOption[];
    poll: Poll;
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.insert(telegramPolls).values(input.poll).onConflictDoUpdate({
      set: input.poll,
      target: telegramPolls.id
    });

    await transaction
      .delete(telegramPollOptions)
      .where(eq(telegramPollOptions.pollId, input.poll.id));

    if (input.options.length > 0) {
      await transaction.insert(telegramPollOptions).values([...input.options]);
    }
  });
}

export async function replacePollAnswerOptions(
  database: Database,
  input: {
    options: readonly PollAnswerOption[];
    pollId: string;
    voterId: string;
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction
      .delete(telegramPollAnswerOptions)
      .where(
        and(
          eq(telegramPollAnswerOptions.pollId, input.pollId),
          eq(telegramPollAnswerOptions.voterId, input.voterId)
        )
      );

    if (input.options.length > 0) {
      await transaction.insert(telegramPollAnswerOptions).values([...input.options]);
    }
  });
}
