import type { ChatFoldersReplacedChange, DomainChange } from '../../domain/changes.js';
import type { ChatFolderInfo } from '../../domain/models/chatFolder.js';
import { tdJsonObject, type UpdateByType } from '../../tdlib/shape.js';

type ChatFoldersUpdate = UpdateByType<'updateChatFolders'>;

export function chatFoldersChanges(update: ChatFoldersUpdate): DomainChange[] {
  return [
    {
      kind: 'chatFolders.replaced',
      folders: update.chat_folders.map(chatFolderInfoRecord)
    } satisfies ChatFoldersReplacedChange
  ];
}

function chatFolderInfoRecord(
  folder: ChatFoldersUpdate['chat_folders'][number],
  position: number
): ChatFolderInfo {
  return {
    colorId: folder.color_id,
    hasMyInviteLinks: folder.has_my_invite_links,
    icon: tdJsonObject(folder.icon),
    id: folder.id,
    isShareable: folder.is_shareable,
    name: tdJsonObject(folder.name),
    position
  };
}
