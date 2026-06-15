import { and, eq, inArray } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramActiveNotificationGroups,
  telegramActiveNotifications
} from '../database/schema.js';
import type {
  ActiveNotificationGroupState,
  ActiveNotificationGroupUpdate,
  ActiveNotification,
  ActiveNotificationSnapshot
} from '../domain/models/activeNotification.js';

type ActiveNotificationGroupStorageRow = typeof telegramActiveNotificationGroups.$inferInsert;
type ActiveNotificationStorageRow = typeof telegramActiveNotifications.$inferInsert;

export async function replaceActiveNotificationSnapshot(
  database: Database,
  snapshot: ActiveNotificationSnapshot
): Promise<void> {
  await database.delete(telegramActiveNotifications);
  await database.delete(telegramActiveNotificationGroups);

  if (snapshot.groups.length > 0) {
    await database.insert(telegramActiveNotificationGroups).values(snapshot.groups.map(groupRow));
  }

  if (snapshot.notifications.length > 0) {
    await database
      .insert(telegramActiveNotifications)
      .values(snapshot.notifications.map(notificationRow));
  }
}

export async function upsertActiveNotification(
  database: Database,
  notification: ActiveNotification
): Promise<void> {
  const row = notificationRow(notification);
  await database
    .insert(telegramActiveNotifications)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramActiveNotifications.groupId, telegramActiveNotifications.id]
    });
}

export async function applyActiveNotificationGroupUpdate(
  database: Database,
  update: ActiveNotificationGroupUpdate
): Promise<void> {
  const group = groupRow(update.group);
  await database.insert(telegramActiveNotificationGroups).values(group).onConflictDoUpdate({
    set: group,
    target: telegramActiveNotificationGroups.id
  });

  if (update.removedNotificationIds.length > 0) {
    await database
      .delete(telegramActiveNotifications)
      .where(
        and(
          eq(telegramActiveNotifications.groupId, update.group.id),
          inArray(telegramActiveNotifications.id, update.removedNotificationIds)
        )
      );
  }

  for (const notification of update.addedNotifications) {
    await upsertActiveNotification(database, notification);
  }
}

function groupRow(group: ActiveNotificationGroupState): ActiveNotificationGroupStorageRow {
  return group;
}

function notificationRow(notification: ActiveNotification): ActiveNotificationStorageRow {
  return notification;
}
