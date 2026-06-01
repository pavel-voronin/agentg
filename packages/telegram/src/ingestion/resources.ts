import type { Database } from '../database/client.js';
import type { FileSubsystem } from '../files/index.js';
import type { LiveCoverageObserver } from '../history/liveCoverage.js';
import type { StatusTracker } from '../status/tracker.js';
import type { AccountIdentity } from '../account/index.js';
import type { UpdateEvents } from './events.js';

export type IngestionResources = {
  account: AccountIdentity['identity'];
  database: Database;
  events: UpdateEvents;
  files: FileSubsystem;
  liveCoverage: LiveCoverageObserver;
  status: StatusTracker;
};
