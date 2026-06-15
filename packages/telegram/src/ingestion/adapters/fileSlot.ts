import { fileSnapshotFromTdlibFile } from '../../tdlib/fileSnapshot.js';
import { tdJsonObject, type UpdateByType } from '../../tdlib/shape.js';
import type { FileSlotRecording } from '../../files/index.js';
import type { FileSnapshot } from '../../domain/models/fileSnapshot.js';

type Chat = UpdateByType<'updateNewChat'>['chat'];
type Message = UpdateByType<'updateNewMessage'>['message'];
type MessageContentUpdate = UpdateByType<'updateMessageContent'>;
type NotificationGroup = UpdateByType<'updateActiveNotifications'>['groups'][number];
type Notification = UpdateByType<'updateNotification'>['notification'];
type QuickReplyMessage = UpdateByType<'updateQuickReplyShortcut'>['shortcut']['first_message'];
type StickerSet = UpdateByType<'updateStickerSet'>['sticker_set'];
type Story = UpdateByType<'updateStory'>['story'];
type TrendingStickerSets = UpdateByType<'updateTrendingStickerSets'>['sticker_sets'];
type UserFullInfo = UpdateByType<'updateUserFullInfo'>['user_full_info'];
type ChatBackground = NonNullable<UpdateByType<'updateChatBackground'>['background']>;
type ChatPhotoInfo = NonNullable<UpdateByType<'updateChatPhoto'>['photo']>;
type ChatTheme = NonNullable<UpdateByType<'updateChatTheme'>['theme']>;
type DefaultBackground = NonNullable<UpdateByType<'updateDefaultBackground'>['background']>;
type EmojiChatTheme = UpdateByType<'updateEmojiChatThemes'>['chat_themes'][number];
type FileUpdate = UpdateByType<'updateFile'>;

export function fileSnapshotFromUpdate(update: FileUpdate): FileSnapshot {
  return fileSnapshotFromTdlibFile(update.file);
}

export function chatFileSlots(chat: Chat): FileSlotRecording {
  return {
    update: {
      chat: {
        chat: tdJsonObject(chat),
        id: String(chat.id)
      }
    }
  };
}

export function chatBackgroundFileSlots(
  chatId: string,
  background: ChatBackground
): FileSlotRecording {
  return {
    scope: {
      slotKeyPrefix: 'background.'
    },
    update: {
      chatBackground: {
        background: tdJsonObject(background),
        chatId
      }
    }
  };
}

export function chatPhotoFileSlots(chatId: string, photo: ChatPhotoInfo | null): FileSlotRecording {
  return {
    scope: {
      slotKeyPrefix: 'avatar.'
    },
    update: {
      chatPhoto: {
        chatId,
        photo: photo === null ? null : tdJsonObject(photo)
      }
    }
  };
}

export function chatThemeFileSlots(chatId: string, theme: ChatTheme | null): FileSlotRecording {
  return {
    scope: {
      slotKeyPrefix: 'theme.'
    },
    update: {
      chatTheme: {
        chatId,
        theme: theme === null ? null : tdJsonObject(theme)
      }
    }
  };
}

export function defaultBackgroundFileSlots(
  key: string,
  background: DefaultBackground | null
): FileSlotRecording {
  return {
    scope: {
      slotKeyPrefix: 'background.'
    },
    update: {
      defaultBackground: {
        background: background === null ? null : tdJsonObject(background),
        key
      }
    }
  };
}

export function emojiChatThemeFileSlots(themes: EmojiChatTheme[]): FileSlotRecording {
  return {
    update: {
      emojiChatThemes: {
        themes: themes.map(tdJsonObject)
      }
    }
  };
}

export function messageContentFileSlots(update: MessageContentUpdate): FileSlotRecording {
  return {
    update: {
      contentUpdate: {
        chatId: String(update.chat_id),
        content: tdJsonObject(update.new_content),
        messageId: String(update.message_id)
      }
    }
  };
}

export function messageFileSlots(message: Message): FileSlotRecording {
  return {
    update: {
      message: {
        chatId: String(message.chat_id),
        content: tdJsonObject(message.content),
        messageId: String(message.id)
      }
    }
  };
}

export function notificationGroupFileSlots(groups: NotificationGroup[]): FileSlotRecording {
  return {
    update: {
      notificationGroups: {
        groups: groups.map(tdJsonObject)
      }
    }
  };
}

export function activeNotificationSnapshotFileSlots(
  groups: NotificationGroup[]
): FileSlotRecording {
  return {
    options: {
      pruneStaleActiveNotificationSlots: true
    },
    update: {
      notificationGroups: {
        groups: groups.map(tdJsonObject)
      }
    }
  };
}

export function notificationFileSlots(
  groupId: number,
  notification: Notification
): FileSlotRecording {
  return {
    update: {
      notificationGroups: {
        groups: [
          {
            id: groupId,
            notifications: [tdJsonObject(notification)]
          }
        ]
      }
    }
  };
}

export function quickReplyMessageFileSlots(message: QuickReplyMessage): FileSlotRecording {
  return {
    update: {
      quickReplyMessage: {
        content: tdJsonObject(message.content),
        messageId: String(message.id)
      }
    }
  };
}

export function stickerSetFileSlots(stickerSet: StickerSet): FileSlotRecording {
  return {
    update: {
      stickerSet: {
        id: stickerSet.id,
        stickerSet: tdJsonObject(stickerSet)
      }
    }
  };
}

export function storyFileSlots(story: Story): FileSlotRecording {
  return {
    update: {
      story: {
        posterChatId: String(story.poster_chat_id),
        story: tdJsonObject(story),
        storyId: story.id
      }
    }
  };
}

export function trendingStickerSetFileSlots(stickerSets: TrendingStickerSets): FileSlotRecording {
  return {
    scope: {
      slotKeyPrefix: 'trending.'
    },
    update: {
      stickerSetInfos: {
        sets: stickerSets.sets.map(tdJsonObject)
      }
    }
  };
}

export function userFullInfoFileSlots(userId: string, info: UserFullInfo): FileSlotRecording {
  return {
    scope: {
      slotKeyPrefix: 'full_info.'
    },
    update: {
      userFullInfo: {
        info: tdJsonObject(info),
        userId
      }
    }
  };
}
