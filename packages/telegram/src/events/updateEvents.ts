import { defineResourceSubsystem } from '@agentg/framework/domain';

import type { TelegramIngestionDomain, TelegramIngestionOptions } from '../tdlib/ingestion.js';
import type { TelegramUpdateEventPublishers } from './updateEventPublishers.js';

export const useUpdateEvents = defineResourceSubsystem<
  TelegramUpdateEventPublishers,
  TelegramIngestionOptions,
  TelegramIngestionDomain
>('update-events', {});
