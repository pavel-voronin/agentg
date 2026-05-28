import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireGroupCallMessageLevelsUpdate =
  TelegramWireUpdateByType<'updateGroupCallMessageLevels'>;

export function handleUpdateGroupCallMessageLevels(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireGroupCallMessageLevelsUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'group_call_message_levels', update.levels);
}
