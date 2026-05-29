import { defineResourceSubsystem } from '@agentg/framework';

import type { TelegramIngestionModule, TelegramIngestionOptions } from '../tdlib/ingestion.js';

export type TelegramStatusTracker = {
  markAuthenticated(authenticated: boolean): void;
  markConnectionState(connectionState: string): boolean;
  markDisconnected(): void;
  publish(): void;
};

export const useTelegramStatus = defineResourceSubsystem<
  TelegramStatusTracker,
  TelegramIngestionOptions,
  TelegramIngestionModule
>('status', {});
