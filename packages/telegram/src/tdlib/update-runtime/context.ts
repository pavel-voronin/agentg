import type { TelegramDatabase } from '../../database/client.js';
import type { TelegramFileSubsystem } from '../../files/subsystem.js';
import type { TelegramLiveCoverageObserver } from '../../history/liveCoverage.js';
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
