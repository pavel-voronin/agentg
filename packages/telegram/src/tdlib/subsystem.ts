import type { Subsystem } from '@agentg/framework/domain';

import { runTelegramIngestion } from './ingestion.js';
import type { TelegramIngestionDomain, TelegramIngestionOptions } from './ingestion.js';

export class TelegramTdlibSubsystem implements Subsystem<
  TelegramIngestionOptions,
  TelegramIngestionDomain
> {
  start(options: TelegramIngestionOptions, domain: TelegramIngestionDomain): Promise<void> {
    return runTelegramIngestion(options, domain);
  }
}
