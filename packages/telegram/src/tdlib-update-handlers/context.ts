import type { TelegramDatabase } from '../database.js';
import type { TelegramFileSubsystem } from '../telegram-file-subsystem.js';
import type { TelegramLiveCoverageObserver } from '../telegram-live-coverage.js';
import type { TelegramUpdateEventPublishers } from './event-publishers.js';

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
