import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { replaceTextCompositionStyles } from '../../store/textCompositionStyle.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireTextCompositionStylesUpdate =
  TelegramWireUpdateByType<'updateTextCompositionStyles'>;

export async function handleUpdateTextCompositionStyles(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireTextCompositionStylesUpdate
): Promise<void> {
  await replaceTextCompositionStyles(context.database, update.styles);
}
