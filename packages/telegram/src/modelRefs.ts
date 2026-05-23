export const TELEGRAM_CHAT_MODEL = 'telegram.chat' as const;
export const TELEGRAM_CHAT_FOLDER_MODEL = 'telegram.chatFolder' as const;
export const TELEGRAM_MESSAGE_MODEL = 'telegram.message' as const;
export const TELEGRAM_USER_MODEL = 'telegram.user' as const;

export type TelegramChatModelRef = {
  _model: typeof TELEGRAM_CHAT_MODEL;
  id: string;
};

export type TelegramChatFolderModelRef = {
  _model: typeof TELEGRAM_CHAT_FOLDER_MODEL;
  id: string;
};

export type TelegramMessageModelRef = {
  _model: typeof TELEGRAM_MESSAGE_MODEL;
  id: string;
};

export type TelegramUserModelRef = {
  _model: typeof TELEGRAM_USER_MODEL;
  id: string;
};

export type TelegramSenderModelRef = TelegramChatModelRef | TelegramUserModelRef;

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
