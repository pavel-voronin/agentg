import type { TelegramDatabase } from '../database.js';
import type { TelegramFileSubsystem } from '../telegramFileSubsystem.js';
import type { TelegramLiveCoverageObserver } from '../telegramLiveCoverage.js';
import type { TelegramUpdateEventPublishers } from '../telegram-events/updateEventPublishers.js';

export type TelegramTdlibStatusHandler = {
  markConnectionState(connectionState: string): boolean;
};

export type TelegramUpdateHandlerContext = {
  database: TelegramDatabase;
  events: TelegramUpdateEventPublishers;
  files: TelegramFileSubsystem;
  liveCoverageObserver: TelegramLiveCoverageObserver;
  tdlibStatus: TelegramTdlibStatusHandler;
};
