import type { TelegramPayload } from './payload.js';

export type SuggestedAction = {
  actionKey: string;
  authorizationDelay: number | null;
  canBeHidden: boolean | null;
  description: TelegramPayload | null;
  managePremiumSubscriptionUrl: string | null;
  name: string | null;
  supergroupId: string | null;
  title: TelegramPayload | null;
  url: string | null;
};
