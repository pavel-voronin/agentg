export const ACTIVE_NOTIFICATION_MODEL = 'telegram.activeNotification' as const;
export const CHAT_MODEL = 'telegram.chat' as const;
export const CHAT_FOLDER_MODEL = 'telegram.chatFolder' as const;
export const DEFAULT_BACKGROUND_MODEL = 'telegram.defaultBackground' as const;
export const EMOJI_CHAT_THEMES_MODEL = 'telegram.emojiChatThemes' as const;
export const MESSAGE_MODEL = 'telegram.message' as const;
export const QUICK_REPLY_MESSAGE_MODEL = 'telegram.quickReplyMessage' as const;
export const STICKER_SET_MODEL = 'telegram.stickerSet' as const;
export const STORY_MODEL = 'telegram.story' as const;
export const USER_MODEL = 'telegram.user' as const;

export type ActiveNotificationModelRef = {
  _model: typeof ACTIVE_NOTIFICATION_MODEL;
  id: string;
};

export type ChatModelRef = {
  _model: typeof CHAT_MODEL;
  id: string;
};

export type ChatFolderModelRef = {
  _model: typeof CHAT_FOLDER_MODEL;
  id: string;
};

export type DefaultBackgroundModelRef = {
  _model: typeof DEFAULT_BACKGROUND_MODEL;
  id: string;
};

export type EmojiChatThemesModelRef = {
  _model: typeof EMOJI_CHAT_THEMES_MODEL;
  id: string;
};

export type MessageModelRef = {
  _model: typeof MESSAGE_MODEL;
  id: string;
};

export type QuickReplyMessageModelRef = {
  _model: typeof QUICK_REPLY_MESSAGE_MODEL;
  id: string;
};

export type StickerSetModelRef = {
  _model: typeof STICKER_SET_MODEL;
  id: string;
};

export type StoryModelRef = {
  _model: typeof STORY_MODEL;
  id: string;
};

export type UserModelRef = {
  _model: typeof USER_MODEL;
  id: string;
};

export type SenderModelRef = ChatModelRef | UserModelRef;

export function activeNotificationRef(input: {
  groupId: number | string;
  notificationId: number | string;
}): ActiveNotificationModelRef {
  return {
    _model: ACTIVE_NOTIFICATION_MODEL,
    id: activeNotificationModelId(input.groupId, input.notificationId)
  };
}

export function activeNotificationModelId(
  groupId: number | string,
  notificationId: number | string
): string {
  return `${String(groupId)}:${String(notificationId)}`;
}

export function activeNotificationModelParts(
  id: string
): { groupId: string; notificationId: string } | null {
  const separator = id.lastIndexOf(':');
  if (separator <= 0 || separator === id.length - 1) {
    return null;
  }
  return {
    groupId: id.slice(0, separator),
    notificationId: id.slice(separator + 1)
  };
}

export function chatRef(chatId: string): ChatModelRef {
  return {
    _model: CHAT_MODEL,
    id: chatId
  };
}

export function chatFolderRef(folderId: number | string): ChatFolderModelRef {
  return {
    _model: CHAT_FOLDER_MODEL,
    id: String(folderId)
  };
}

export function defaultBackgroundRef(key: string): DefaultBackgroundModelRef {
  return {
    _model: DEFAULT_BACKGROUND_MODEL,
    id: key
  };
}

export function emojiChatThemesRef(): EmojiChatThemesModelRef {
  return {
    _model: EMOJI_CHAT_THEMES_MODEL,
    id: 'emoji_chat_themes'
  };
}

export function messageRef(input: { chatId: string; messageId: string }): MessageModelRef {
  return {
    _model: MESSAGE_MODEL,
    id: messageModelId(input.chatId, input.messageId)
  };
}

export function messageModelId(chatId: string, messageId: string): string {
  return `${chatId}:${messageId}`;
}

export function messageModelParts(id: string): { chatId: string; messageId: string } | null {
  const separator = id.lastIndexOf(':');
  if (separator <= 0 || separator === id.length - 1) {
    return null;
  }
  return {
    chatId: id.slice(0, separator),
    messageId: id.slice(separator + 1)
  };
}

export function quickReplyMessageRef(messageId: string): QuickReplyMessageModelRef {
  return {
    _model: QUICK_REPLY_MESSAGE_MODEL,
    id: messageId
  };
}

export function stickerSetRef(stickerSetId: string): StickerSetModelRef {
  return {
    _model: STICKER_SET_MODEL,
    id: stickerSetId
  };
}

export function storyRef(input: { posterChatId: string; storyId: number | string }): StoryModelRef {
  return {
    _model: STORY_MODEL,
    id: storyModelId(input.posterChatId, input.storyId)
  };
}

export function storyModelId(posterChatId: string, storyId: number | string): string {
  return `${posterChatId}:${String(storyId)}`;
}

export function userRef(userId: string): UserModelRef {
  return {
    _model: USER_MODEL,
    id: userId
  };
}

export function messageSenderRef(
  senderType: string | null | undefined,
  senderId: string | null | undefined
): SenderModelRef | null {
  if (senderId === null || senderId === undefined) {
    return null;
  }
  if (senderType === 'messageSenderUser') {
    return userRef(senderId);
  }
  if (senderType === 'messageSenderChat') {
    return chatRef(senderId);
  }
  return null;
}
