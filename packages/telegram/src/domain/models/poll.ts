import type { TelegramPayload } from './payload.js';

export type Poll = {
  allowsMultipleAnswers: boolean;
  allowsRevoting: boolean;
  canGetVoters: boolean;
  closeDate: Date;
  countryCodes: TelegramPayload;
  id: string;
  isAnonymous: boolean;
  isClosed: boolean;
  membersOnly: boolean;
  openPeriod: number;
  optionOrder: TelegramPayload;
  options: TelegramPayload;
  question: TelegramPayload;
  recentVoterIds: TelegramPayload;
  totalVoterCount: number;
  type: TelegramPayload;
  voteRestrictionReason: TelegramPayload;
};

export type PollOption = {
  additionDate: Date;
  author: TelegramPayload;
  id: string;
  isBeingChosen: boolean;
  isChosen: boolean;
  media: TelegramPayload;
  optionPosition: number;
  pollId: string;
  recentVoterIds: TelegramPayload;
  text: TelegramPayload;
  votePercentage: number;
  voterCount: number;
};

export type PollAnswerOption = {
  optionId: string;
  optionPosition: number;
  pollId: string;
  voterId: string;
};
