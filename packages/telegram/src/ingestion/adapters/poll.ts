import type { JsonValue } from '@agentg/framework';

import type {
  DomainChange,
  PollAnswerOptionsReplacedChange,
  PollReplacedChange
} from '../../domain/changes.js';
import type { PollOption, Poll } from '../../domain/models/poll.js';
import { tdId, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';

type PollUpdate = UpdateByType<'updatePoll'>;
type TdlibPoll = PollUpdate['poll'] & {
  country_codes?: string[];
  members_only?: boolean;
  vote_restriction_reason?: JsonValue | null;
};
type PollAnswerUpdate = UpdateByType<'updatePollAnswer'>;
type MessageSender = PollAnswerUpdate['voter_id'];

export function pollChanges(update: PollUpdate): DomainChange[] {
  return [
    {
      kind: 'poll.replaced',
      input: {
        options: pollOptionRecords(update.poll),
        poll: pollRecord(update.poll)
      }
    } satisfies PollReplacedChange
  ];
}

export function pollAnswerChanges(update: PollAnswerUpdate): DomainChange[] {
  if (update.option_ids.length !== update.option_positions.length) {
    throw new Error('Poll answer option vectors must have equal length');
  }

  const pollId = requiredId(update.poll_id);
  const voterId = messageSenderKey(update.voter_id);
  return [
    {
      kind: 'pollAnswerOptions.replaced',
      input: {
        options: update.option_positions.map((optionPosition, index) => ({
          optionId: update.option_ids[index] ?? '',
          optionPosition,
          pollId,
          voterId
        })),
        pollId,
        voterId
      }
    } satisfies PollAnswerOptionsReplacedChange
  ];
}

function pollRecord(poll: TdlibPoll): Poll {
  return {
    allowsMultipleAnswers: poll.allows_multiple_answers,
    allowsRevoting: poll.allows_revoting,
    canGetVoters: poll.can_get_voters,
    closeDate: tdTimestamp(poll.close_date),
    countryCodes: requiredJsonValue(poll.country_codes),
    id: requiredId(poll.id),
    isAnonymous: poll.is_anonymous,
    isClosed: poll.is_closed,
    membersOnly: requiredBoolean(poll.members_only, 'members_only'),
    openPeriod: poll.open_period,
    optionOrder: requiredJsonValue(poll.option_order),
    options: requiredJsonValue(poll.options),
    question: requiredJsonValue(poll.question),
    recentVoterIds: requiredJsonValue(poll.recent_voter_ids),
    totalVoterCount: poll.total_voter_count,
    type: requiredJsonValue(poll.type),
    voteRestrictionReason: requiredJsonValue(poll.vote_restriction_reason ?? null)
  };
}

function pollOptionRecords(poll: TdlibPoll): PollOption[] {
  const pollId = requiredId(poll.id);
  return poll.options.map((option, optionPosition) => ({
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
  }));
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

function requiredBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Expected Telegram poll ${fieldName}`);
  }
  return value;
}

function messageSenderKey(sender: MessageSender): string {
  if (sender._ === 'messageSenderUser') {
    return `user:${requiredId(sender.user_id)}`;
  }
  return `chat:${requiredId(sender.chat_id)}`;
}
