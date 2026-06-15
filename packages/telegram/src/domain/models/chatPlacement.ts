import { z } from 'zod';

import { nonNegativeIntegerSchema } from './scalars.js';

export const chatPlacementSchema = z.discriminatedUnion('kind', [
  z.object({
    isPinned: z.boolean(),
    kind: z.literal('archive'),
    order: z.string()
  }),
  z.object({
    isPinned: z.boolean(),
    kind: z.literal('main'),
    order: z.string()
  }),
  z.object({
    folderId: nonNegativeIntegerSchema,
    isPinned: z.boolean(),
    kind: z.literal('folder'),
    order: z.string()
  })
]);

import type { ChatPositionState } from './chatState.js';

export type ChatPlacement = z.infer<typeof chatPlacementSchema>;

export function chatPlacementFromRecord(
  record: Pick<ChatPositionState, 'isPinned' | 'listKey' | 'order'>
): ChatPlacement | null {
  if (record.listKey === 'main') {
    return {
      isPinned: record.isPinned,
      kind: 'main',
      order: record.order
    };
  }
  if (record.listKey === 'archive') {
    return {
      isPinned: record.isPinned,
      kind: 'archive',
      order: record.order
    };
  }
  const folderMatch = /^folder:(\d+)$/.exec(record.listKey);
  if (folderMatch?.[1] === undefined) {
    return null;
  }
  return {
    folderId: Number(folderMatch[1]),
    isPinned: record.isPinned,
    kind: 'folder',
    order: record.order
  };
}
