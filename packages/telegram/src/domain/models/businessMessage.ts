export type BusinessMessageState = {
  connectionId: string;
  messageChatId: string;
  messageId: string;
  replyToMessageChatId: string | null;
  replyToMessageId: string | null;
};
