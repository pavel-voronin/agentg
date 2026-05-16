import type { JsonObject } from '@agentg/events/json';
import { z } from 'zod';

import { tdlibChatFolder, type TdlibChatFolder } from './ChatFolders.js';
import { tdlibJsonObject } from './common.js';

const tdlibUpdateChatFoldersInputSchema = z
  .strictObject({
    _: z.literal('updateChatFolders'),
    are_tags_enabled: z.optional(z.boolean()),
    chat_folders: z.array(z.unknown()),
    main_chat_list_position: z.optional(z.number().int())
  })
  .transform((update) => ({
    _: update._,
    ...(update.are_tags_enabled === undefined ? {} : { are_tags_enabled: update.are_tags_enabled }),
    chat_folders: update.chat_folders.map((folder, index) => tdlibChatFolder(folder, index)),
    ...(update.main_chat_list_position === undefined
      ? {}
      : { main_chat_list_position: update.main_chat_list_position }),
    updateChatFolders: tdlibJsonObject(update)
  }));

export type TdlibUpdateChatFolders = {
  _: 'updateChatFolders';
  are_tags_enabled?: boolean;
  chat_folders: TdlibChatFolder[];
  main_chat_list_position?: number;
  updateChatFolders: JsonObject;
};

export const tdlibUpdateChatFoldersSchema = tdlibUpdateChatFoldersInputSchema;

export function tdlibUpdateChatFolders(input: unknown): TdlibUpdateChatFolders {
  return tdlibUpdateChatFoldersSchema.parse(input);
}
