export const TELEGRAM_ACTIVE_NOTIFICATION_MODEL = 'telegram.activeNotification' as const;
export const TELEGRAM_CHAT_MODEL = 'telegram.chat' as const;
export const TELEGRAM_CHAT_FOLDER_MODEL = 'telegram.chatFolder' as const;
export const TELEGRAM_DEFAULT_BACKGROUND_MODEL = 'telegram.defaultBackground' as const;
export const TELEGRAM_EMOJI_CHAT_THEMES_MODEL = 'telegram.emojiChatThemes' as const;
export const TELEGRAM_MESSAGE_MODEL = 'telegram.message' as const;
export const TELEGRAM_QUICK_REPLY_MESSAGE_MODEL = 'telegram.quickReplyMessage' as const;
export const TELEGRAM_STICKER_SET_MODEL = 'telegram.stickerSet' as const;
export const TELEGRAM_STORY_MODEL = 'telegram.story' as const;
export const TELEGRAM_USER_MODEL = 'telegram.user' as const;

export type TelegramActiveNotificationModelRef = {
  _model: typeof TELEGRAM_ACTIVE_NOTIFICATION_MODEL;
  id: string;
};

export type TelegramChatModelRef = {
  _model: typeof TELEGRAM_CHAT_MODEL;
  id: string;
};

export type TelegramChatFolderModelRef = {
  _model: typeof TELEGRAM_CHAT_FOLDER_MODEL;
  id: string;
};

export type TelegramDefaultBackgroundModelRef = {
  _model: typeof TELEGRAM_DEFAULT_BACKGROUND_MODEL;
  id: string;
};

export type TelegramEmojiChatThemesModelRef = {
  _model: typeof TELEGRAM_EMOJI_CHAT_THEMES_MODEL;
  id: string;
};

export type TelegramMessageModelRef = {
  _model: typeof TELEGRAM_MESSAGE_MODEL;
  id: string;
};

export type TelegramQuickReplyMessageModelRef = {
  _model: typeof TELEGRAM_QUICK_REPLY_MESSAGE_MODEL;
  id: string;
};

export type TelegramStickerSetModelRef = {
  _model: typeof TELEGRAM_STICKER_SET_MODEL;
  id: string;
};

export type TelegramStoryModelRef = {
  _model: typeof TELEGRAM_STORY_MODEL;
  id: string;
};

export type TelegramUserModelRef = {
  _model: typeof TELEGRAM_USER_MODEL;
  id: string;
};

export type TelegramSenderModelRef = TelegramChatModelRef | TelegramUserModelRef;

export function telegramActiveNotificationRef(input: {
  groupId: number | string;
  notificationId: number | string;
}): TelegramActiveNotificationModelRef {
  return {
    _model: TELEGRAM_ACTIVE_NOTIFICATION_MODEL,
    id: telegramActiveNotificationModelId(input.groupId, input.notificationId)
  };
}

export function telegramActiveNotificationModelId(
  groupId: number | string,
  notificationId: number | string
): string {
  return `${String(groupId)}:${String(notificationId)}`;
}

export function telegramActiveNotificationModelParts(
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

export function telegramChatRef(chatId: string): TelegramChatModelRef {
  return {
    _model: TELEGRAM_CHAT_MODEL,
    id: chatId
  };
}

export function telegramChatFolderRef(folderId: number | string): TelegramChatFolderModelRef {
  return {
    _model: TELEGRAM_CHAT_FOLDER_MODEL,
    id: String(folderId)
  };
}

export function telegramDefaultBackgroundRef(key: string): TelegramDefaultBackgroundModelRef {
  return {
    _model: TELEGRAM_DEFAULT_BACKGROUND_MODEL,
    id: key
  };
}

export function telegramEmojiChatThemesRef(): TelegramEmojiChatThemesModelRef {
  return {
    _model: TELEGRAM_EMOJI_CHAT_THEMES_MODEL,
    id: 'emoji_chat_themes'
  };
}

export function telegramMessageRef(input: {
  chatId: string;
  messageId: string;
}): TelegramMessageModelRef {
  return {
    _model: TELEGRAM_MESSAGE_MODEL,
    id: telegramMessageModelId(input.chatId, input.messageId)
  };
}

export function telegramMessageModelId(chatId: string, messageId: string): string {
  return `${chatId}:${messageId}`;
}

export function telegramMessageModelParts(
  id: string
): { chatId: string; messageId: string } | null {
  const separator = id.lastIndexOf(':');
  if (separator <= 0 || separator === id.length - 1) {
    return null;
  }
  return {
    chatId: id.slice(0, separator),
    messageId: id.slice(separator + 1)
  };
}

export function telegramQuickReplyMessageRef(messageId: string): TelegramQuickReplyMessageModelRef {
  return {
    _model: TELEGRAM_QUICK_REPLY_MESSAGE_MODEL,
    id: messageId
  };
}

export function telegramStickerSetRef(stickerSetId: string): TelegramStickerSetModelRef {
  return {
    _model: TELEGRAM_STICKER_SET_MODEL,
    id: stickerSetId
  };
}

export function telegramStoryRef(input: {
  posterChatId: string;
  storyId: number | string;
}): TelegramStoryModelRef {
  return {
    _model: TELEGRAM_STORY_MODEL,
    id: telegramStoryModelId(input.posterChatId, input.storyId)
  };
}

export function telegramStoryModelId(posterChatId: string, storyId: number | string): string {
  return `${posterChatId}:${String(storyId)}`;
}

export function telegramUserRef(userId: string): TelegramUserModelRef {
  return {
    _model: TELEGRAM_USER_MODEL,
    id: userId
  };
}

export function telegramMessageSenderRef(
  senderType: string | null | undefined,
  senderId: string | null | undefined
): TelegramSenderModelRef | null {
  if (senderId === null || senderId === undefined) {
    return null;
  }
  if (senderType === 'messageSenderUser') {
    return telegramUserRef(senderId);
  }
  if (senderType === 'messageSenderChat') {
    return telegramChatRef(senderId);
  }
  return null;
}
