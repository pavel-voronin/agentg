import { defineResourceSubsystem } from '@agentg/framework/domain';

import type { TelegramIngestionDomain, TelegramIngestionOptions } from '../tdlib/ingestion.js';
import type { TelegramLiveCoverageObserver } from './liveCoverage.js';

export const useLiveCoverage = defineResourceSubsystem<
  TelegramLiveCoverageObserver,
  TelegramIngestionOptions,
  TelegramIngestionDomain
>('live-coverage', {});
