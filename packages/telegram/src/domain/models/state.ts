import type { TelegramPayload } from './payload.js';

export type ContactCloseBirthday = {
  birthdate: TelegramPayload;
  userId: string;
};

export type TextCompositionStyle = {
  creatorUserId: string | null;
  customEmojiId: string | null;
  englishExample: TelegramPayload | null;
  installCount: number | null;
  isCreator: boolean;
  isCustom: boolean;
  name: string;
  prompt: string | null;
  title: string;
};

export type ChatRevenueAmount = {
  availableAmount: string;
  balanceAmount: string;
  chatId: string;
  cryptocurrency: string;
  totalAmount: string;
  withdrawalEnabled: boolean;
};

export type FileGenerationRequest = {
  conversion: string;
  destinationPath: string;
  generationId: string;
  originalPath: string;
};

export type ChatBoost = {
  chatId: string;
  count: number;
  expirationDate: Date;
  id: string;
  source: TelegramPayload;
  startDate: Date;
};

export type ChatActiveStories = {
  canBeArchived: boolean;
  chatId: string;
  list: TelegramPayload;
  maxReadStoryId: number;
  order: string;
  stories: TelegramPayload;
};
