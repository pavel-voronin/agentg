import type { TelegramPayload } from './payload.js';

export type AttachmentMenuBot = {
  androidIconFileId: number | null;
  androidSideMenuIconFileId: number | null;
  botUserId: string;
  defaultIconFileId: number | null;
  iconColor: TelegramPayload | null;
  iosAnimatedIconFileId: number | null;
  iosSideMenuIconFileId: number | null;
  iosStaticIconFileId: number | null;
  isAdded: boolean;
  macosIconFileId: number | null;
  macosSideMenuIconFileId: number | null;
  name: string;
  nameColor: TelegramPayload | null;
  requestWriteAccess: boolean;
  showDisclaimerInSideMenu: boolean;
  showInAttachmentMenu: boolean;
  showInSideMenu: boolean;
  supportsBotChats: boolean;
  supportsChannelChats: boolean;
  supportsGroupChats: boolean;
  supportsSelfChat: boolean;
  supportsUserChats: boolean;
  webAppPlaceholderFileId: number | null;
};
