import { and, eq, inArray } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramActiveNotificationGroups,
  telegramActiveNotifications
} from '../database/schema.js';
import { tdDate, tdId, tdJsonValue, type UpdateByType } from '../tdlib/value.js';
import type { message as Message } from 'tdlib-types';
import { storeMessage } from './message.js';

type ActiveNotificationsUpdate = UpdateByType<'updateActiveNotifications'>;
type ActiveNotificationGroup = ActiveNotificationsUpdate['groups'][number];
type ActiveNotification = ActiveNotificationGroup['notifications'][number];
type NotificationUpdate = UpdateByType<'updateNotification'>;
type NotificationGroupUpdate = UpdateByType<'updateNotificationGroup'>;

export async function replaceActiveNotificationSnapshot(
  database: Database,
  groups: ActiveNotificationGroup[]
): Promise<void> {
  await database.transaction(async (transaction) => {
    for (const message of notificationMessages(groups)) {
      await storeMessage(transaction, message);
    }

    await transaction.delete(telegramActiveNotifications);
    await transaction.delete(telegramActiveNotificationGroups);

    if (groups.length > 0) {
      await transaction.insert(telegramActiveNotificationGroups).values(groups.map(groupRow));
    }

    const notifications = groups.flatMap(notificationRows);
    if (notifications.length > 0) {
      await transaction.insert(telegramActiveNotifications).values(notifications);
    }
  });
}

export async function upsertActiveNotification(
  database: Database,
  input: {
    groupId: number;
    notification: NotificationUpdate['notification'];
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    for (const message of notificationMessages([
      {
        _: 'notificationGroup',
        chat_id: 0,
        id: input.groupId,
        notifications: [input.notification],
        total_count: 0,
        type: { _: 'notificationGroupTypeMessages' }
      }
    ])) {
      await storeMessage(transaction, message);
    }

    const row = notificationRow(input.groupId, input.notification);
    await transaction
      .insert(telegramActiveNotifications)
      .values(row)
      .onConflictDoUpdate({
        set: row,
        target: [telegramActiveNotifications.groupId, telegramActiveNotifications.id]
      });
  });
}

export async function applyActiveNotificationGroupUpdate(
  database: Database,
  update: NotificationGroupUpdate
): Promise<void> {
  await database.transaction(async (transaction) => {
    const row: typeof telegramActiveNotificationGroups.$inferInsert = {
      chatId: String(update.chat_id),
      id: update.notification_group_id,
      notificationSettingsChatId: String(update.notification_settings_chat_id),
      notificationSoundId: tdId(update.notification_sound_id),
      totalCount: update.total_count,
      type: update.type._
    };

    await transaction.insert(telegramActiveNotificationGroups).values(row).onConflictDoUpdate({
      set: row,
      target: telegramActiveNotificationGroups.id
    });

    if (update.removed_notification_ids.length > 0) {
      await transaction
        .delete(telegramActiveNotifications)
        .where(
          and(
            eq(telegramActiveNotifications.groupId, update.notification_group_id),
            inArray(telegramActiveNotifications.id, update.removed_notification_ids)
          )
        );
    }

    for (const message of notificationMessages([
      {
        _: 'notificationGroup',
        chat_id: update.chat_id,
        id: update.notification_group_id,
        notifications: update.added_notifications,
        total_count: update.total_count,
        type: update.type
      }
    ])) {
      await storeMessage(transaction, message);
    }

    for (const notification of update.added_notifications) {
      const notificationInsert = notificationRow(update.notification_group_id, notification);
      await transaction
        .insert(telegramActiveNotifications)
        .values(notificationInsert)
        .onConflictDoUpdate({
          set: notificationInsert,
          target: [telegramActiveNotifications.groupId, telegramActiveNotifications.id]
        });
    }
  });
}

function groupRow(
  group: ActiveNotificationGroup
): typeof telegramActiveNotificationGroups.$inferInsert {
  return {
    chatId: String(group.chat_id),
    id: group.id,
    notificationSettingsChatId: null,
    notificationSoundId: null,
    totalCount: group.total_count,
    type: group.type._
  };
}

function notificationRows(
  group: ActiveNotificationGroup
): (typeof telegramActiveNotifications.$inferInsert)[] {
  return group.notifications.map((notification) => notificationRow(group.id, notification));
}

function notificationRow(
  groupId: number,
  notification: ActiveNotification
): typeof telegramActiveNotifications.$inferInsert {
  const row: typeof telegramActiveNotifications.$inferInsert = {
    callId: null,
    date: requiredTelegramDate(notification.date),
    groupId,
    id: notification.id,
    isSilent: notification.is_silent,
    messageChatId: null,
    messageId: null,
    pushContent: null,
    pushIsOutgoing: null,
    pushMessageId: null,
    pushSenderId: null,
    pushSenderName: null,
    showPreview: null,
    type: notification.type._
  };

  switch (notification.type._) {
    case 'notificationTypeNewMessage':
      return {
        ...row,
        messageChatId: String(notification.type.message.chat_id),
        messageId: String(notification.type.message.id),
        showPreview: notification.type.show_preview
      };
    case 'notificationTypeNewCall':
      return {
        ...row,
        callId: notification.type.call_id
      };
    case 'notificationTypeNewPushMessage':
      return {
        ...row,
        pushContent: tdJsonValue(notification.type.content) ?? null,
        pushIsOutgoing: notification.type.is_outgoing,
        pushMessageId: tdId(notification.type.message_id),
        pushSenderId: tdJsonValue(notification.type.sender_id) ?? null,
        pushSenderName: notification.type.sender_name
      };
    case 'notificationTypeNewSecretChat':
      return row;
  }
}

function* notificationMessages(groups: ActiveNotificationGroup[]): Generator<Message> {
  for (const group of groups) {
    for (const notification of group.notifications) {
      if (notification.type._ === 'notificationTypeNewMessage') {
        yield notification.type.message;
      }
    }
  }
}

function requiredTelegramDate(value: number): Date {
  const date = tdDate(value);
  if (date === undefined) {
    throw new Error(`Active notification has invalid date: ${String(value)}`);
  }
  return date;
}
