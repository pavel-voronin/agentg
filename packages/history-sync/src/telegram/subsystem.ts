import { defineResourceSubsystem } from '@agentg/framework/domain';

import type { HistorySyncServiceDomain, HistorySyncServiceOptions } from '../service/runService.js';
import type { TelegramReadClient } from '../telegramClient.js';

export const useTelegram = defineResourceSubsystem<
  TelegramReadClient,
  HistorySyncServiceOptions,
  HistorySyncServiceDomain
>('telegram', {
  fromContext(context) {
    return isTelegramContext(context) ? context.telegram : undefined;
  }
});

function isTelegramContext(context: unknown): context is { telegram: TelegramReadClient } {
  return typeof context === 'object' && context !== null && 'telegram' in context;
}
