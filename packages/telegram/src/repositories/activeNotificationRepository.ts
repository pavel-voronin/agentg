import type { Database } from '../database/client.js';
import type {
  ActiveNotificationGroupUpdate,
  ActiveNotification,
  ActiveNotificationSnapshot
} from '../domain/models/activeNotification.js';
import {
  applyActiveNotificationGroupUpdate,
  replaceActiveNotificationSnapshot,
  upsertActiveNotification
} from '../storage/activeNotificationStorage.js';

export type ActiveNotificationRepository = {
  applyGroupUpdate(update: ActiveNotificationGroupUpdate): Promise<void>;
  replaceSnapshot(snapshot: ActiveNotificationSnapshot): Promise<void>;
  upsert(notification: ActiveNotification): Promise<void>;
};

export function createActiveNotificationRepository(
  database: Database
): ActiveNotificationRepository {
  return {
    applyGroupUpdate(update) {
      return applyActiveNotificationGroupUpdate(database, update);
    },
    replaceSnapshot(snapshot) {
      return replaceActiveNotificationSnapshot(database, snapshot);
    },
    upsert(notification) {
      return upsertActiveNotification(database, notification);
    }
  };
}
