import { and, eq, inArray } from 'drizzle-orm';

import type { TelegramDatabase } from '../database.js';
import { telegramActiveNotificationGroups, telegramActiveNotifications } from '../schema.js';
import {
  telegramWireDate,
  telegramWireId,
  telegramWireJsonValue,
  type TelegramWireMessage,
  type TelegramWireUpdateByType
} from '../tdlib/wire.js';
import { storeMessage } from './message.js';

type TelegramWireActiveNotificationsUpdate = TelegramWireUpdateByType<'updateActiveNotifications'>;
type TelegramWireActiveNotificationGroup = TelegramWireActiveNotificationsUpdate['groups'][number];
type TelegramWireActiveNotification = TelegramWireActiveNotificationGroup['notifications'][number];
type TelegramWireNotificationUpdate = TelegramWireUpdateByType<'updateNotification'>;
type TelegramWireNotificationGroupUpdate = TelegramWireUpdateByType<'updateNotificationGroup'>;

export async function replaceActiveNotificationSnapshot(
  database: TelegramDatabase,
  groups: TelegramWireActiveNotificationGroup[]
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
  database: TelegramDatabase,
  input: {
    groupId: number;
    notification: TelegramWireNotificationUpdate['notification'];
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
  database: TelegramDatabase,
  update: TelegramWireNotificationGroupUpdate
): Promise<void> {
  await database.transaction(async (transaction) => {
    const row: typeof telegramActiveNotificationGroups.$inferInsert = {
      chatId: String(update.chat_id),
      id: update.notification_group_id,
      notificationSettingsChatId: String(update.notification_settings_chat_id),
      notificationSoundId: telegramWireId(update.notification_sound_id),
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
  group: TelegramWireActiveNotificationGroup
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
  group: TelegramWireActiveNotificationGroup
): (typeof telegramActiveNotifications.$inferInsert)[] {
  return group.notifications.map((notification) => notificationRow(group.id, notification));
}

function notificationRow(
  groupId: number,
  notification: TelegramWireActiveNotification
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
        pushContent: telegramWireJsonValue(notification.type.content) ?? null,
        pushIsOutgoing: notification.type.is_outgoing,
        pushMessageId: telegramWireId(notification.type.message_id),
        pushSenderId: telegramWireJsonValue(notification.type.sender_id) ?? null,
        pushSenderName: notification.type.sender_name
      };
    case 'notificationTypeNewSecretChat':
      return row;
  }
}

function* notificationMessages(
  groups: TelegramWireActiveNotificationGroup[]
): Generator<TelegramWireMessage> {
  for (const group of groups) {
    for (const notification of group.notifications) {
      if (notification.type._ === 'notificationTypeNewMessage') {
        yield notification.type.message;
      }
    }
  }
}

function requiredTelegramDate(value: number): Date {
  const date = telegramWireDate(value);
  if (date === undefined) {
    throw new Error(`Active notification has invalid date: ${String(value)}`);
  }
  return date;
}
