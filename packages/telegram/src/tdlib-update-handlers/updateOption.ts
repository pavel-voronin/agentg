import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireOptionUpdate = TelegramWireUpdateByType<'updateOption'>;

export function handleUpdateOption(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireOptionUpdate
): Promise<void> {
  return upsertTelegramKv(database, `option:${update.name}`, update.value);
}
