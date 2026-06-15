import type { ChatList$Input } from 'tdlib-types';

export type InitialChatListKind =
  | {
      kind: 'archive' | 'main';
    }
  | {
      folderId: number;
      kind: 'folder';
    };

export function chatListInputFromKind(chatList: InitialChatListKind): ChatList$Input {
  switch (chatList.kind) {
    case 'main':
      return { _: 'chatListMain' };
    case 'archive':
      return { _: 'chatListArchive' };
    case 'folder':
      return { _: 'chatListFolder', chat_folder_id: chatList.folderId };
  }
}
