import { applyDomainChanges, type ApplyChangeResult } from '../application/applyChanges.js';
import type { Database } from '../database/client.js';
import type { DomainChange } from '../domain/changes.js';
import { createRepositories } from '../repositories/repositories.js';
import type { IngestionResources } from './resources.js';

export function applyIngestionChanges(
  resources: IngestionResources,
  changes: readonly DomainChange[]
): Promise<ApplyChangeResult[]> {
  return applyIngestionChangesToDatabase(resources, resources.database, changes);
}

export function applyIngestionChangesToDatabase(
  resources: IngestionResources,
  database: Database,
  changes: readonly DomainChange[]
): Promise<ApplyChangeResult[]> {
  return applyDomainChanges({
    changes,
    events: resources.events,
    repositories: createRepositories(database)
  });
}
