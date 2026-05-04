import type { EventBus } from '../bus/eventBus.js';
import type { HistoryService } from '../history/historyService.js';
import type { TelegramService } from '../telegram/telegramService.js';

export type TrustedPlugin = {
  name: string;
  start(context: PluginContext): Promise<void> | void;
  stop(): Promise<void> | void;
};

export type PluginContext = {
  eventBus: EventBus;
  historyService: HistoryService;
  telegramService: TelegramService;
};
