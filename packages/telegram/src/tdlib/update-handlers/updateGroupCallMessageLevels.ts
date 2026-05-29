import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireGroupCallMessageLevelsUpdate =
  TelegramWireUpdateByType<'updateGroupCallMessageLevels'>;

export function handleUpdateGroupCallMessageLevels(
  update: TelegramWireGroupCallMessageLevelsUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'group_call_message_levels', update.levels);
}
