import type { message as Message } from 'tdlib-types';

import type { DomainChange } from '../../domain/changes.js';
import type {
  ActiveNotificationGroupState,
  ActiveNotification
} from '../../domain/models/activeNotification.js';
import { messageStateFromTdlibMessage } from '../../tdlib/messageState.js';
import { tdDate, tdId, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';

type ActiveNotificationsUpdate = UpdateByType<'updateActiveNotifications'>;
type ActiveNotificationGroup = ActiveNotificationsUpdate['groups'][number];
type TdlibActiveNotification = ActiveNotificationGroup['notifications'][number];
type NotificationUpdate = UpdateByType<'updateNotification'>;
type NotificationGroupUpdate = UpdateByType<'updateNotificationGroup'>;

export function activeNotificationSnapshotChanges(
  groups: ActiveNotificationGroup[]
): DomainChange[] {
  return [
    {
      kind: 'activeNotificationSnapshot.replaced',
      snapshot: {
        groups: groups.map(groupRecord),
        messages: notificationMessages(groups).map(messageStateFromTdlibMessage),
        notifications: groups.flatMap(notificationRecords)
      }
    }
  ];
}

export function activeNotificationChanges(input: {
  groupId: number;
  notification: NotificationUpdate['notification'];
}): DomainChange[] {
  return [
    {
      kind: 'activeNotification.upserted',
      messages: notificationMessages([
        {
          _: 'notificationGroup',
          chat_id: 0,
          id: input.groupId,
          notifications: [input.notification],
          total_count: 0,
          type: { _: 'notificationGroupTypeMessages' }
        }
      ]).map(messageStateFromTdlibMessage),
      notification: notificationRecord(input.groupId, input.notification)
    }
  ];
}

export function activeNotificationGroupUpdateChanges(
  update: NotificationGroupUpdate
): DomainChange[] {
  const group = syntheticNotificationGroup(update);
  return [
    {
      kind: 'activeNotificationGroup.updated',
      update: {
        addedMessages: notificationMessages([group]).map(messageStateFromTdlibMessage),
        addedNotifications: update.added_notifications.map((notification) =>
          notificationRecord(update.notification_group_id, notification)
        ),
        group: notificationGroupUpdateRecord(update),
        removedNotificationIds: [...update.removed_notification_ids]
      }
    }
  ];
}

export function syntheticNotificationGroup(
  update: NotificationGroupUpdate
): ActiveNotificationGroup {
  return {
    _: 'notificationGroup',
    chat_id: update.chat_id,
    id: update.notification_group_id,
    notifications: update.added_notifications,
    total_count: update.total_count,
    type: update.type
  };
}

function notificationGroupUpdateRecord(
  update: NotificationGroupUpdate
): ActiveNotificationGroupState {
  return {
    chatId: String(update.chat_id),
    id: update.notification_group_id,
    notificationSettingsChatId: String(update.notification_settings_chat_id),
    notificationSoundId: nullableTdId(update.notification_sound_id),
    totalCount: update.total_count,
    type: update.type._
  };
}

function groupRecord(group: ActiveNotificationGroup): ActiveNotificationGroupState {
  return {
    chatId: String(group.chat_id),
    id: group.id,
    notificationSettingsChatId: null,
    notificationSoundId: null,
    totalCount: group.total_count,
    type: group.type._
  };
}

function notificationRecords(group: ActiveNotificationGroup): ActiveNotification[] {
  return group.notifications.map((notification) => notificationRecord(group.id, notification));
}

function notificationRecord(
  groupId: number,
  notification: TdlibActiveNotification
): ActiveNotification {
  const row: ActiveNotification = {
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
        pushMessageId: nullableTdId(notification.type.message_id),
        pushSenderId: tdJsonValue(notification.type.sender_id) ?? null,
        pushSenderName: notification.type.sender_name
      };
    case 'notificationTypeNewSecretChat':
      return row;
  }
}

function notificationMessages(groups: ActiveNotificationGroup[]): Message[] {
  return groups.flatMap((group) =>
    group.notifications.flatMap((notification) =>
      notification.type._ === 'notificationTypeNewMessage' ? [notification.type.message] : []
    )
  );
}

function requiredTelegramDate(value: number): Date {
  const date = tdDate(value);
  if (date === undefined) {
    throw new Error(`Active notification has invalid date: ${String(value)}`);
  }
  return date;
}

function nullableTdId(value: number | string | undefined): string | null {
  return tdId(value) ?? null;
}
