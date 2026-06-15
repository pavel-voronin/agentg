import type { EventBus } from '@agentg/framework';

import type { Database } from '../database/client.js';
import type { FileSubsystem } from '../files/index.js';
import type { LiveCoverageObserver } from '../history/liveCoverage.js';
import type { StatusTracker } from '../status/tracker.js';
import type { AccountIdentity } from '../account/index.js';

export type IngestionResources = {
  account: AccountIdentity['identity'];
  database: Database;
  events: EventBus;
  files: FileSubsystem;
  liveCoverage: LiveCoverageObserver;
  status: StatusTracker;
};
