import { defineResourceSubsystem } from '@agentg/framework';

import type { TelegramIngestionModule, TelegramIngestionOptions } from '../tdlib/ingestion.js';
import type { TelegramLiveCoverageObserver } from './liveCoverage.js';

export const useLiveCoverage = defineResourceSubsystem<
  TelegramLiveCoverageObserver,
  TelegramIngestionOptions,
  TelegramIngestionModule
>('live-coverage', {});
