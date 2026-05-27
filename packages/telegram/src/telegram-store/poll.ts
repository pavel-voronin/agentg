import { and, eq } from 'drizzle-orm';

import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database.js';
import { telegramPollAnswerOptions, telegramPollOptions, telegramPolls } from '../schema.js';
import {
  telegramWireId,
  telegramWireJsonValue,
  type TelegramWireUpdateByType
} from '../telegramWire.js';

type TelegramWirePoll = TelegramWireUpdateByType<'updatePoll'>['poll'] & {
  country_codes?: string[];
  members_only?: boolean;
  vote_restriction_reason?: JsonValue | null;
};
type TelegramWirePollAnswerUpdate = TelegramWireUpdateByType<'updatePollAnswer'>;
type TelegramWireMessageSender = TelegramWirePollAnswerUpdate['voter_id'];

export async function replaceTelegramPoll(
  database: TelegramDatabase,
  poll: TelegramWirePoll
): Promise<void> {
  await database.transaction(async (transaction) => {
    const pollId = requiredTelegramWireId(poll.id);
    const pollRow: typeof telegramPolls.$inferInsert = {
      allowsMultipleAnswers: poll.allows_multiple_answers,
      allowsRevoting: poll.allows_revoting,
      canGetVoters: poll.can_get_voters,
      closeDate: telegramWireTimestamp(poll.close_date),
      countryCodes: requiredTelegramWireJsonValue(poll.country_codes ?? []),
      id: pollId,
      isAnonymous: poll.is_anonymous,
      isClosed: poll.is_closed,
      membersOnly: poll.members_only ?? false,
      openPeriod: poll.open_period,
      optionOrder: requiredTelegramWireJsonValue(poll.option_order),
      options: requiredTelegramWireJsonValue(poll.options),
      question: requiredTelegramWireJsonValue(poll.question),
      recentVoterIds: requiredTelegramWireJsonValue(poll.recent_voter_ids),
      totalVoterCount: poll.total_voter_count,
      type: requiredTelegramWireJsonValue(poll.type),
      voteRestrictionReason: requiredTelegramWireJsonValue(poll.vote_restriction_reason ?? null)
    };

    await transaction.insert(telegramPolls).values(pollRow).onConflictDoUpdate({
      set: pollRow,
      target: telegramPolls.id
    });

    await transaction.delete(telegramPollOptions).where(eq(telegramPollOptions.pollId, pollId));

    const optionRows = poll.options.map((option, optionPosition) => ({
      additionDate: telegramWireTimestamp(option.addition_date),
      author: requiredTelegramWireJsonValue(option.author ?? null),
      id: option.id,
      isBeingChosen: option.is_being_chosen,
      isChosen: option.is_chosen,
      media: requiredTelegramWireJsonValue(option.media),
      optionPosition,
      pollId,
      recentVoterIds: requiredTelegramWireJsonValue(option.recent_voter_ids),
      text: requiredTelegramWireJsonValue(option.text),
      votePercentage: option.vote_percentage,
      voterCount: option.voter_count
    })) satisfies (typeof telegramPollOptions.$inferInsert)[];

    if (optionRows.length > 0) {
      await transaction.insert(telegramPollOptions).values(optionRows);
    }
  });
}

export async function replaceTelegramPollAnswerOptions(
  database: TelegramDatabase,
  update: TelegramWirePollAnswerUpdate
): Promise<void> {
  if (update.option_ids.length !== update.option_positions.length) {
    throw new Error('Poll answer option vectors must have equal length');
  }

  const pollId = requiredTelegramWireId(update.poll_id);
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

function telegramWireTimestamp(value: number): Date {
  return new Date(value * 1000);
}

function requiredTelegramWireId(value: number | string): string {
  const id = telegramWireId(value);
  if (id === undefined) {
    throw new Error('Expected Telegram wire id');
  }
  return id;
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}

function messageSenderKey(sender: TelegramWireMessageSender): string {
  if (sender._ === 'messageSenderUser') {
    return `user:${requiredTelegramWireId(sender.user_id)}`;
  }
  return `chat:${requiredTelegramWireId(sender.chat_id)}`;
}
