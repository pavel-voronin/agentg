import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireOptionUpdate = TelegramWireUpdateByType<'updateOption'>;

export function handleUpdateOption(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireOptionUpdate
): Promise<void> {
  return upsertTelegramKv(database, `option:${update.name}`, update.value);
}
