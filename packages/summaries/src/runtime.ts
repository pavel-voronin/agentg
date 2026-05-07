import type { EventBus } from '@agentg/events/bus';

import type { SummaryRepository } from './store.js';

export type SummariesRuntime = {
  eventBus: EventBus;
  now?: (() => Date) | undefined;
  repository: SummaryRepository;
};
