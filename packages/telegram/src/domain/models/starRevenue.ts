import type { TelegramPayload } from './payload.js';

export type StarRevenueStatus = {
  availableAmount: TelegramPayload;
  currentAmount: TelegramPayload;
  nextWithdrawalIn: number;
  ownerId: string;
  totalAmount: TelegramPayload;
  withdrawalEnabled: boolean;
};
