import { and, eq } from 'drizzle-orm';

import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import {
  telegramPollAnswerOptions,
  telegramPollOptions,
  telegramPolls
} from '../database/schema.js';
import { tdId, tdJsonValue, type UpdateByType } from '../tdlib/shape.js';

type Poll = UpdateByType<'updatePoll'>['poll'] & {
  country_codes?: string[];
  members_only?: boolean;
  vote_restriction_reason?: JsonValue | null;
};
type PollAnswerUpdate = UpdateByType<'updatePollAnswer'>;
type MessageSender = PollAnswerUpdate['voter_id'];

export async function replaceTelegramPoll(database: Database, poll: Poll): Promise<void> {
  await database.transaction(async (transaction) => {
    const pollId = requiredId(poll.id);
    const pollRow: typeof telegramPolls.$inferInsert = {
      allowsMultipleAnswers: poll.allows_multiple_answers,
      allowsRevoting: poll.allows_revoting,
      canGetVoters: poll.can_get_voters,
      closeDate: tdTimestamp(poll.close_date),
      countryCodes: requiredJsonValue(poll.country_codes),
      id: pollId,
      isAnonymous: poll.is_anonymous,
      isClosed: poll.is_closed,
      membersOnly: poll.members_only,
      openPeriod: poll.open_period,
      optionOrder: requiredJsonValue(poll.option_order),
      options: requiredJsonValue(poll.options),
      question: requiredJsonValue(poll.question),
      recentVoterIds: requiredJsonValue(poll.recent_voter_ids),
      totalVoterCount: poll.total_voter_count,
      type: requiredJsonValue(poll.type),
      voteRestrictionReason: requiredJsonValue(poll.vote_restriction_reason ?? null)
    };

    await transaction.insert(telegramPolls).values(pollRow).onConflictDoUpdate({
      set: pollRow,
      target: telegramPolls.id
    });

    await transaction.delete(telegramPollOptions).where(eq(telegramPollOptions.pollId, pollId));

    const optionRows = poll.options.map((option, optionPosition) => ({
      additionDate: tdTimestamp(option.addition_date),
      author: requiredJsonValue(option.author ?? null),
      id: option.id,
      isBeingChosen: option.is_being_chosen,
      isChosen: option.is_chosen,
      media: requiredJsonValue(option.media),
      optionPosition,
      pollId,
      recentVoterIds: requiredJsonValue(option.recent_voter_ids),
      text: requiredJsonValue(option.text),
      votePercentage: option.vote_percentage,
      voterCount: option.voter_count
    })) satisfies (typeof telegramPollOptions.$inferInsert)[];

    if (optionRows.length > 0) {
      await transaction.insert(telegramPollOptions).values(optionRows);
    }
  });
}

export async function replaceTelegramPollAnswerOptions(
  database: Database,
  update: PollAnswerUpdate
): Promise<void> {
  if (update.option_ids.length !== update.option_positions.length) {
    throw new Error('Poll answer option vectors must have equal length');
  }

  const pollId = requiredId(update.poll_id);
  const voterId = messageSenderKey(update.voter_id);

  await database.transaction(async (transaction) => {
    await transaction
      .delete(telegramPollAnswerOptions)
      .where(
        and(
          eq(telegramPollAnswerOptions.pollId, pollId),
          eq(telegramPollAnswerOptions.voterId, voterId)
        )
      );

    const rows = update.option_positions.map((optionPosition, index) => ({
      optionId: update.option_ids[index] ?? '',
      optionPosition,
      pollId,
      voterId
    })) satisfies (typeof telegramPollAnswerOptions.$inferInsert)[];

    if (rows.length > 0) {
      await transaction.insert(telegramPollAnswerOptions).values(rows);
    }
  });
}

function tdTimestamp(value: number): Date {
  return new Date(value * 1000);
}

function requiredId(value: number | string): string {
  const id = tdId(value);
  if (id === undefined) {
    throw new Error('Expected Telegram wire id');
  }
  return id;
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}

function messageSenderKey(sender: MessageSender): string {
  if (sender._ === 'messageSenderUser') {
    return `user:${requiredId(sender.user_id)}`;
  }
  return `chat:${requiredId(sender.chat_id)}`;
}
