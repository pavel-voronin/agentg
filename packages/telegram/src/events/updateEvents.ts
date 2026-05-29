import { defineResourceSubsystem } from '@agentg/framework';

import type { TelegramIngestionModule, TelegramIngestionOptions } from '../tdlib/ingestion.js';
import type { TelegramUpdateEventPublishers } from './updateEventPublishers.js';

export const useUpdateEvents = defineResourceSubsystem<
  TelegramUpdateEventPublishers,
  TelegramIngestionOptions,
  TelegramIngestionModule
>('update-events', {});
