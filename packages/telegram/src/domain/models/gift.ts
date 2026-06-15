import type { TelegramPayload } from './payload.js';

export type GiftAuction = {
  giftsPerRound: number;
  id: string;
  startDate: Date;
};

export type Gift = {
  auctionId: string | null;
  background: TelegramPayload;
  defaultSellStarCount: string;
  firstSendDate: Date;
  hasColors: boolean;
  id: string;
  isForBirthday: boolean;
  isPremium: boolean;
  lastSendDate: Date;
  nextSendDate: Date;
  overallLimits: TelegramPayload;
  publisherChatId: string | null;
  starCount: string;
  stickerFileId: number;
  upgradeStarCount: string;
  upgradeVariantCount: number | null | undefined;
  userLimits: TelegramPayload;
};

export type GiftAuctionState = {
  auctionId: string;
  giftId: string;
  state: TelegramPayload;
};

export type UpgradedGift = {
  backdrop: TelegramPayload;
  canSendPurchaseOffer: boolean;
  colors: TelegramPayload;
  craftProbabilityPerMille: number;
  giftAddress: string | null;
  hostId: TelegramPayload;
  id: string;
  isBurned: boolean;
  isCrafted: boolean;
  isPremium: boolean;
  isThemeAvailable: boolean;
  maxUpgradedCount: number;
  model: TelegramPayload;
  name: string;
  number: number;
  originalDetails: TelegramPayload;
  ownerAddress: string | null;
  ownerId: TelegramPayload;
  ownerName: string;
  publisherChatId: string | null;
  regularGiftId: string;
  resaleParameters: TelegramPayload;
  symbol: TelegramPayload;
  title: string;
  totalUpgradedCount: number;
  usedThemeChatId: string | null;
  valueAmount: string;
  valueCurrency: string;
  valueUsdAmount: string;
};
