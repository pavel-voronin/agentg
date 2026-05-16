import type { JsonObject } from '@agentg/events/json';
import { z } from 'zod';

import { tdlibJsonObject } from './common.js';

const tdlibChatFolderInputSchema = z.looseObject({
  chatFolderId: z.optional(z.number().int()),
  chat_folder_id: z.optional(z.number().int()),
  icon: z.optional(z.unknown()),
  id: z.optional(z.number().int()),
  name: z.optional(z.unknown()),
  title: z.optional(z.unknown())
});

type TdlibChatFolderInput = z.infer<typeof tdlibChatFolderInputSchema>;

export type TdlibChatFolder = {
  iconName?: string;
  id: number;
  position: number;
  chatFolder: JsonObject;
  title: string;
};

export const tdlibChatFolderSchema = tdlibChatFolderInputSchema.transform(buildTdlibChatFolder);

export function tdlibChatFolder(input: unknown, position: number): TdlibChatFolder {
  const folder = tdlibChatFolderSchema.parse(input);
  return { ...folder, position };
}

function buildTdlibChatFolder(folder: TdlibChatFolderInput): Omit<TdlibChatFolder, 'position'> {
  const id = folder.id ?? folder.chat_folder_id ?? folder.chatFolderId;
  if (id === undefined) {
    throw new Error('TDLib chat folder has no id');
  }

  const title = folderTitle(folder) ?? `Folder ${String(id)}`;
  const iconName = folderIconName(folder.icon);

  return {
    id,
    chatFolder: tdlibJsonObject(folder),
    title,
    ...(iconName === undefined ? {} : { iconName })
  };
}

function folderTitle(folder: TdlibChatFolderInput): string | undefined {
  const name = plainRecord(folder.name);
  const formattedText = plainRecord(name?.text);
  const formattedTitle = plainRecord(folder.title);
  const candidates = [
    formattedText?.text,
    name?.text,
    folder.title,
    formattedTitle?.text,
    folder.name
  ];

  return candidates.find((value): value is string => typeof value === 'string' && value.length > 0);
}

function folderIconName(value: unknown): string | undefined {
  const icon = plainRecord(value);
  return typeof icon?.name === 'string' && icon.name.length > 0 ? icon.name : undefined;
}

function plainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
