import type {
  DomainChange,
  QuickReplyMessagesReplacedChange,
  QuickReplyShortcutDeletedChange,
  QuickReplyShortcutSavedChange
} from '../../domain/changes.js';
import type { QuickReplyMessageState, QuickReplyShortcut } from '../../domain/models/quickReply.js';
import { tdId, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';

type TdlibQuickReplyShortcut = UpdateByType<'updateQuickReplyShortcut'>['shortcut'];
type QuickReplyMessage = UpdateByType<'updateQuickReplyShortcutMessages'>['messages'][number];
type QuickReplyShortcutDeletedUpdate = UpdateByType<'updateQuickReplyShortcutDeleted'>;
type QuickReplyShortcutMessagesUpdate = UpdateByType<'updateQuickReplyShortcutMessages'>;
type QuickReplyShortcutUpdate = UpdateByType<'updateQuickReplyShortcut'>;

export function quickReplyShortcutChanges(update: QuickReplyShortcutUpdate): DomainChange[] {
  const firstMessage = quickReplyMessageState(update.shortcut.first_message, update.shortcut.id, 0);
  return [
    {
      kind: 'quickReplyShortcut.saved',
      input: {
        firstMessage,
        shortcut: quickReplyShortcutRecord(update.shortcut, firstMessage.id)
      }
    } satisfies QuickReplyShortcutSavedChange
  ];
}

export function quickReplyShortcutDeletedChanges(
  update: QuickReplyShortcutDeletedUpdate
): DomainChange[] {
  return [
    {
      kind: 'quickReplyShortcut.deleted',
      shortcutId: update.shortcut_id
    } satisfies QuickReplyShortcutDeletedChange
  ];
}

export function quickReplyShortcutMessagesChanges(
  update: QuickReplyShortcutMessagesUpdate
): DomainChange[] {
  return [
    {
      kind: 'quickReplyMessages.replaced',
      input: {
        messages: update.messages.map((message, order) =>
          quickReplyMessageState(message, update.shortcut_id, order)
        ),
        shortcutId: update.shortcut_id
      }
    } satisfies QuickReplyMessagesReplacedChange
  ];
}

function quickReplyShortcutRecord(
  shortcut: TdlibQuickReplyShortcut,
  firstMessageId: string
): QuickReplyShortcut {
  return {
    firstMessageId,
    id: shortcut.id,
    messageCount: shortcut.message_count,
    name: shortcut.name
  };
}

function quickReplyMessageState(
  message: QuickReplyMessage,
  shortcutId: number,
  order: number
): QuickReplyMessageState {
  return {
    canBeEdited: message.can_be_edited,
    content: requiredJsonValue(message.content),
    id: requiredId(message.id),
    mediaAlbumId: zeroIdToNull(message.media_album_id),
    order,
    replyMarkup: requiredJsonValue(message.reply_markup ?? null),
    replyToMessageId: zeroIdToNull(message.reply_to_message_id),
    sendingState: requiredJsonValue(message.sending_state ?? null),
    shortcutId,
    viaBotUserId: requiredId(message.via_bot_user_id)
  };
}

function zeroIdToNull(value: number | string): string | null {
  return String(value) === '0' ? null : requiredId(value);
}

function requiredId(value: number | string): string {
  const id = tdId(value);
  if (id === undefined) {
    throw new Error('Expected Telegram wire id');
  }
  return id;
}

function requiredJsonValue(value: unknown) {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
