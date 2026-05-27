type TelegramWireChatList = {
  _: string;
  chat_folder_id?: number | string;
};

export function chatListKey(list: TelegramWireChatList): string {
  if (list._ === 'chatListMain') {
    return 'main';
  }
  if (list._ === 'chatListArchive') {
    return 'archive';
  }
  if (list._ === 'chatListFolder' && list.chat_folder_id !== undefined) {
    return `folder:${String(list.chat_folder_id)}`;
  }
  throw new Error(`Unsupported chat list constructor: ${list._}`);
}
