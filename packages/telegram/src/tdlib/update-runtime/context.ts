import type { TelegramDatabase } from '../../database.js';
import type { TelegramFileSubsystem } from '../../fileSubsystem.js';
import type { TelegramLiveCoverageObserver } from '../../liveCoverage.js';
import type { TelegramUpdateEventPublishers } from '../../events/updateEventPublishers.js';

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
