import type { Subsystem } from '@agentg/framework/domain';

import { runHistorySyncService } from './runService.js';
import type { HistorySyncServiceDomain, HistorySyncServiceOptions } from './runService.js';

export class HistorySyncServiceSubsystem implements Subsystem<
  HistorySyncServiceOptions,
  HistorySyncServiceDomain
> {
  start(options: HistorySyncServiceOptions, domain: HistorySyncServiceDomain): Promise<void> {
    return runHistorySyncService(options, domain);
  }
}
