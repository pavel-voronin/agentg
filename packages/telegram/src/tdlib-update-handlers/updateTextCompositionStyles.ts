import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { replaceTextCompositionStyles } from '../telegram-store/textCompositionStyle.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireTextCompositionStylesUpdate =
  TelegramWireUpdateByType<'updateTextCompositionStyles'>;

export async function handleUpdateTextCompositionStyles(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireTextCompositionStylesUpdate
): Promise<void> {
  await replaceTextCompositionStyles(context.database, update.styles);
}
