import type { JsonValue } from '@agentg/framework';
import type { file as TdlibFile } from 'tdlib-types';

import type { AttachmentMenuBotsReplacedChange, DomainChange } from '../../domain/changes.js';
import type { AttachmentMenuBot } from '../../domain/models/attachmentMenuBot.js';
import type { FileState } from '../../domain/models/fileState.js';
import { tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import { fileStateFromTdlibFile } from './fileState.js';

type AttachmentMenuBotsUpdate = UpdateByType<'updateAttachmentMenuBots'>;
type TdlibAttachmentMenuBot = AttachmentMenuBotsUpdate['bots'][number];

export function attachmentMenuBotsChanges(update: AttachmentMenuBotsUpdate): DomainChange[] {
  return [
    {
      kind: 'attachmentMenuBots.replaced',
      input: {
        bots: update.bots.map(attachmentMenuBotRecord),
        files: attachmentMenuBotFileStates(update.bots)
      }
    } satisfies AttachmentMenuBotsReplacedChange
  ];
}

function attachmentMenuBotRecord(bot: TdlibAttachmentMenuBot): AttachmentMenuBot {
  return {
    androidIconFileId: bot.android_icon?.id ?? null,
    androidSideMenuIconFileId: bot.android_side_menu_icon?.id ?? null,
    botUserId: String(bot.bot_user_id),
    defaultIconFileId: bot.default_icon?.id ?? null,
    iconColor: nullableJsonValue(bot.icon_color ?? null),
    iosAnimatedIconFileId: bot.ios_animated_icon?.id ?? null,
    iosSideMenuIconFileId: bot.ios_side_menu_icon?.id ?? null,
    iosStaticIconFileId: bot.ios_static_icon?.id ?? null,
    isAdded: bot.is_added,
    macosIconFileId: bot.macos_icon?.id ?? null,
    macosSideMenuIconFileId: bot.macos_side_menu_icon?.id ?? null,
    name: bot.name,
    nameColor: nullableJsonValue(bot.name_color ?? null),
    requestWriteAccess: bot.request_write_access,
    showDisclaimerInSideMenu: bot.show_disclaimer_in_side_menu,
    showInAttachmentMenu: bot.show_in_attachment_menu,
    showInSideMenu: bot.show_in_side_menu,
    supportsBotChats: bot.supports_bot_chats,
    supportsChannelChats: bot.supports_channel_chats,
    supportsGroupChats: bot.supports_group_chats,
    supportsSelfChat: bot.supports_self_chat,
    supportsUserChats: bot.supports_user_chats,
    webAppPlaceholderFileId: bot.web_app_placeholder?.id ?? null
  };
}

function attachmentMenuBotFileStates(bots: readonly TdlibAttachmentMenuBot[]): FileState[] {
  const filesById = new Map<number, FileState>();
  for (const bot of bots) {
    for (const file of attachmentMenuBotFiles(bot)) {
      filesById.set(file.id, fileStateFromTdlibFile(file));
    }
  }
  return [...filesById.values()];
}

function* attachmentMenuBotFiles(bot: TdlibAttachmentMenuBot): Generator<TdlibFile> {
  const files = [
    bot.default_icon,
    bot.ios_static_icon,
    bot.ios_animated_icon,
    bot.ios_side_menu_icon,
    bot.android_icon,
    bot.android_side_menu_icon,
    bot.macos_icon,
    bot.macos_side_menu_icon,
    bot.web_app_placeholder
  ];

  for (const file of files) {
    if (file !== undefined) {
      yield file;
    }
  }
}

function nullableJsonValue(value: unknown): JsonValue | null {
  return tdJsonValue(value) ?? null;
}
